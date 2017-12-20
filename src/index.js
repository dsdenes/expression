const _ = require('lodash');
const traverse = require('traverse');
const util = require('util');
const assert = require('assert');

class CantMutateError extends Error {}

function every() { return  _.every.apply(null, arguments); }
function some() { return  _.some.apply(null, arguments); }

const logics = {
  every,
  some,
};

function eq() { return  _.eq.apply(null, arguments); }
function gt() { return  _.gt.apply(null, arguments); }
function lt() { return  _.lt.apply(null, arguments); }
function gte() { return  _.gte.apply(null, arguments); }
function lte() { return  _.lte.apply(null, arguments); }

const operators = {
  eq,
  gt,
  lt,
  gte,
  lte
};

function Expression(config = {}) {

  config = _.defaults(config, {
    tree: [every, []],
    variables: {}
  });

  // console.log('INTI: ', config.tree);
  assert(isGroupNode(config.tree), 'The root level of the given tree has to be a logical group.');

  const variables = Object.assign({}, config.variables);

  let tree = traverse(config.tree);

  return {
    evaluate,
    mutate,
    getPath,
    print,
    setRandomTree,
    getRandomValue,
    getVariable,
    serialize,
    deserialize
  };

  function serialize(node = getPath([])) {
    if (isGroupNode(node)) {
      const logic = getLogicFromGroup(node);
      const expressions = getExpressionsFromGroup(node);
      return [logic.name, expressions.map(serialize)];
    } else {
      return node.map(nodeItem => {
        if (_.isFunction(nodeItem)) {
          return nodeItem.name;
        } else if (nodeItem.__wrapped) {
          return { __wrapped: true, name: nodeItem.name };
        } else {
          return nodeItem;
        }
      });
    }
  }

  function print() {
    console.log(util.inspect(getPath([]), false, null));
  }

  function evaluate(payload = {}, node = getPath([])) {
    // console.log(util.inspect(node, false, null));
    if (isGroupNode(node)) {
      const logic = getLogicFromGroup(node);
      const expressions = getExpressionsFromGroup(node);
      const results = expressions.map(expression => evaluate(payload, expression));
      return logic(results);
    } else {
      return evaluateExpression(node, payload);
    }
  }

  function evaluateExpression(expression, payload) {
    // console.log('EVALUATE', util.inspect(expression, false, null));
    const operator = getOperatorFromExpression(expression);
    const expressionValues = _.tail(expression).map(value => getValue(value, payload));
    return operator.apply(null, expressionValues);
  }

  function mutate() {
    const rand = _.random(true);

    try {
      // 20%
      if (_.inRange(rand, 0, 0.20)) {
        addRandomExpression();

        // 20%
      } else if (_.inRange(rand, 0.2, 0.4)) {
        removeRandomExpression();

        // 60%
      } else {
        mutateRandomExpression();
      }
    } catch (err) {
      if (err instanceof CantMutateError) {
        mutate();
      } else {
        throw err;
      }
    }
  }

  function getPath(path) {
    return tree.get(path);
  }

  function setPath(path, payload) {
    return tree.set(path, payload);
  }

  function mutateRandomExpression() {
    let expressionPathArray = getRandomOneSideWrappedVariableExpressionPath();
    if (!_.isArray(expressionPathArray) || !expressionPathArray.length) {
      throw new CantMutateError();
    }
    let expression = getPath(expressionPathArray);
    let payload = getOneSideExpressionPayload(expression);
    const variableName = getOneSideExpressionVariableName(expression);
    let newPayload;
    while ((newPayload = modifyByRandomPercent(payload)) && !isValidVariablePayload(variableName, newPayload));
    expression = setOneSideExpressionPayload(expression, newPayload);
    setExpressionAtExpressionPath(expressionPathArray, expression);
  }

  function removeRandomExpression() {
    const expressionGroupPath = getRandomGroupPath();
    const expressionGroup = getPath(expressionGroupPath);
    const expressions = getExpressionsFromGroup(expressionGroup);
    if (expressions.length > 1) {
      const expression = _.sample(expressions);
      removeExpressionAtGroupPath(expressionGroupPath, expression);
    }
  }

  function addRandomExpression() {
    const randomGroupLevelPath = getRandomGroupPath();
    const expression = getRandomExpression();
    return addExpressionAtGroupPath(randomGroupLevelPath, expression);
  }

  function addExpressionAtGroupPath(expressionGroupPath, expression) {
    const expressionGroup = getPath(expressionGroupPath);
    const expressions = getExpressionsFromGroup(expressionGroup);
    expressions.push(expression);
    setExpressionsAtGroupPath(expressionGroupPath, expressions);
  }

  function removeExpressionAtGroupPath(expressionGroupPath, expression) {
    const expressionGroup = getPath(expressionGroupPath);
    const expressions = getExpressionsFromGroup(expressionGroup);
    _.pull(expressions, expression);
    setExpressionsAtGroupPath(expressionGroupPath, expressions);
  }

  function isOneSideWrappedVariableExpression(expression) {
    return isExpression(expression) && isWrappedVariable(expression[1]) && isStaticValue(expression[2]);
  }

  function isValidVariablePayload(variableName, payload) {
    return _.clamp(payload, getVariableLowerBound(variableName), getVariableUpperBound(variableName)) === payload;
  }

  function getOneSideExpressionVariableName(expression) {
    return expression[1].name;
  }

  function getOneSideExpressionPayload(expression) {
    return expression[2];
  }

  function setOneSideExpressionPayload(expression, payload) {
    expression[2] = payload;
    return expression;
  }

  function getOperatorFromExpression(expression) {
    return expression[0];
  }

  function getValue(expressionValue, payload) {
    if (isWrappedVariable(expressionValue)) {
      return expressionValue.get(payload);
    } else if (_.isFunction(expressionValue)) {
      return expressionValue(payload);
    } else {
      return expressionValue;
    }
  }

  function isWrappedVariable(expressionValue) {
    return Boolean(expressionValue.__wrapped);
  }

  function isStaticValue(expressionValue) {
    return Number.isFinite(expressionValue);
  }

  function setExpressionsAtGroupPath(path, expressions) {
    path.push([1]);
    setPath(path, expressions);
  }

  function setExpressionAtExpressionPath(path, expressions) {
    setPath(path, expressions);
  }

  function getRandomOneSideWrappedVariableExpressionPath() {
    const expressionPaths = [];
    tree.map(function() {
      const node = getPath(this.path);
      if (isOneSideWrappedVariableExpression(node)) {
        expressionPaths.push(this.path);
      }
    });
    return _.sample(expressionPaths);
  }

  function getRandomGroupPath() {
    const groupPaths = [];
    tree.map(function() {
      if (isGroupTreeNode(this)) {
        groupPaths.push(this.path);
      }
    });
    return _.sample(groupPaths);
  }

  function isExpression(expression) {
    return Array.isArray(expression) && Object.values(operators).includes(expression[0]);
  }

  function isGroupTreeNode(node) {
    return node.isRoot || isGroupPath(node.path);
  }

  function isGroupNode(node) {
    // console.log(Object.values(logics).includes(node[0]), Object.values(logics), node[0]);
    return Array.isArray(node) && Object.values(logics).includes(node[0]);
  }

  function isGroupPath(path) {
    const node = getPath(path);
    return path === [] || isGroupNode(node);
  }

  function getRandomValue(variableName) {
    return _.random(getVariableLowerBound(variableName), getVariableUpperBound(variableName), true);
  }

  function modifyByRandomPercent(value, maxPercent = 10) {
    const percent = _.random(0, maxPercent, true);
    const share = value * (percent / 100);
    return _.random() ? value + share : value - share;
  }

  function getVariableLowerBound(variableName) {
    return variables[variableName][0];
  }

  function getVariableUpperBound(variableName) {
    return variables[variableName][1];
  }

  function setRandomTree() {
    tree = traverse([_.sample(Object.values(logics)), [getRandomExpression()]]);
  }

  function getRandomExpression() {

    let expr;
    const availableVariableBounds = Object.keys(variables);
    assert(availableVariableBounds.length, 'There should be at least one variable defined.');

    const rand = _.random(true);

    // Variable expression
    if (_.inRange(rand, 0, 0.7)) {
      expr = [];
      expr.push(_.sample(Object.values(operators)));
      const firstVariableName = _.sample(availableVariableBounds);
      expr.push(getVariable(firstVariableName));
      _.pull(availableVariableBounds, firstVariableName);

      // Both sides are variables
      if (_.random() && availableVariableBounds.length > 0) {
        const secondVariableName = _.sample(availableVariableBounds);
        expr.push(getVariable(secondVariableName));

      // One side is static
      } else {
        expr.push(getRandomValue(firstVariableName));
      }

    // Expression group
    } else {
      expr = [_.sample(Object.values(logics)), [getRandomExpression()]];
    }

    return expr;
  }

}

function deserialize(node) {
  if (isSerializedGroupNode(node)) {
    const logic = getLogicFromSerializedGroup(node);
    const expressions = getExpressionsFromSerializedGroup(node);
    return [logic, expressions.map(deserialize)];
  } else {
    return node.map(nodeItem => {
      if (nodeItem in operators) {
        return operators[nodeItem];
      } else if (nodeItem.__wrapped) {
        return getVariable(nodeItem.name);
      } else {
        return nodeItem;
      }
    });
  }
}

function isSerializedGroupNode(node) {
  return Array.isArray(node) && node[0] in logics;
}

function getLogicFromGroup(group) {
  return group[0];
}

function getExpressionsFromGroup(group) {
  return group[1];
}

function getLogicFromSerializedGroup(group) {
  return logics[group[0]];
}

function getExpressionsFromSerializedGroup(group) {
  return group[1];
}

function getVariable(name) {
  return {
    __wrapped: true,
    name,
    get: payload => payload[name],
  }
}



Expression.deserialize = deserialize;

module.exports = Expression;
