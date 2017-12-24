const Expression = require('./index');

const variables = {
  VAR1: [0, 0],
  VAR2: [0, 1],
  VAR3: [-100, 0],
  VAR4: [0, 2],
  VAR5: [0, 1000],
  VAR6: [0, 100],
  VAR7: [0, 100],
  VAR8: [0, 100],
  VAR9: [0, 100]
};

test(`Pass objects by reference for the sake of speed`, () => {
  const expression = Expression({ tree: Expression.deserialize(['some', [['eq', 1, 1]]]) });
  const rootPathValue = expression.getPath([]);
  rootPathValue[1][0][1] = 2;
  expect(expression.getPath([1,0,1])).toBe(2);
});

test(`Mutate random expression`, () => {
  const expression = Expression({ tree: Expression.deserialize(['every', [['eq', { __wrapped: true, name: 'VAR4' }, 1]]]), variables });
  expect(expression.getPath([1,0,2])).toBe(1);
  expression.mutateRandomExpression();
  expect(expression.getPath([1,0,2])).not.toBe(1);
});

test(`Remove random expression`, () => {
  const expression = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1],['eq', 1, 2]]]), variables });
  expect(expression.getPath([1])).toHaveLength(2);
  expect(expression.getPath([1,0,2])).toBe(1);
  expect(expression.getPath([1,1,2])).toBe(2);
  expression.removeRandomExpression();
  expect(expression.getPath([1])).toHaveLength(1);
  expect(expression.getPath([1,0,1])).toBe(1);
});

test(`Add random expression`, () => {
  const expression = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]), variables });
  expect(expression.getPath([1])).toHaveLength(1);
  expect(expression.getPath([1,0,1])).toBe(1);
  expect(expression.getPath([1,0,2])).toBe(1);
  expression.addRandomExpression();
  expect(expression.getPath([1])).toHaveLength(2);
});

test('static expression', () => {

  expect(Expression({ tree: Expression.deserialize(['some', [['eq', 1, 1]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['some', [['eq', 1, 2]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['some', [['eq', 1, 1], ['eq', 1, 2]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['every', [['eq', 1, 2]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1], ['eq', 1, 2]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['every', [['every', [['eq', 1, 1], ['eq', 1, 1]]]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['every', [['every', [['eq', 1, 1], ['eq', 1, 2]]]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['some', [['every', [['eq', 1, 1], ['eq', 1, 2]]]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['some', [['some', [['eq', 1, 1], ['eq', 1, 2]]]]]) }).evaluate()).toBe(true);

});

test('generated expressions', () => {

  const expression = Expression({ variables });

  expression.setRandomTree();

  for (let i = 0; i < 100; i++) {
    expression.mutate();
    expression.evaluate({
      VAR1: expression.getRandomValue('VAR1'),
      VAR2: expression.getRandomValue('VAR2'),
      VAR3: expression.getRandomValue('VAR3'),
      VAR4: expression.getRandomValue('VAR4'),
      VAR5: expression.getRandomValue('VAR5'),
      VAR6: expression.getRandomValue('VAR6'),
      VAR7: expression.getRandomValue('VAR7'),
      VAR8: expression.getRandomValue('VAR8'),
      VAR9: expression.getRandomValue('VAR9'),
    });
  }
});

test('serialization / deserialization', () => {

  const config = {
    variables
  };

  let expression = Expression(config);
  expression.setRandomTree();

  for (let i = 0; i < 100; i++) {

    const payload = {
      VAR1: expression.getRandomValue('VAR1'),
      VAR2: expression.getRandomValue('VAR2'),
      VAR3: expression.getRandomValue('VAR3'),
      VAR4: expression.getRandomValue('VAR4'),
      VAR5: expression.getRandomValue('VAR5'),
      VAR6: expression.getRandomValue('VAR6'),
      VAR7: expression.getRandomValue('VAR7'),
      VAR8: expression.getRandomValue('VAR8'),
      VAR9: expression.getRandomValue('VAR9'),
    };

    expression.mutate();

    const serialized = JSON.stringify(expression.serialize());
    config.tree = expression.deserialize(JSON.parse(serialized));
    let exp2 = Expression(config);
    expect(expression.evaluate(payload)).toEqual(exp2.evaluate(payload));
  }
});

test('crossover', () => {

  const expression1 = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]), variables });
  const expression2 = Expression({ tree: Expression.deserialize(['every', [['gt', 2, 1]]]), variables });

  const offspring = Expression.crossover(expression1, expression2);
  offspring.mutate({ add: 1, remove: 0, mutate: 0 });

  expect(expression1.getPath([1])).toHaveLength(1);
  expect(expression1.getPath([1,0,1])).toBe(1);
  expect(expression1.getPath([1,0,2])).toBe(1);

  expect(expression2.getPath([1])).toHaveLength(1);
  expect(expression2.getPath([1,0,1])).toBe(2);
  expect(expression2.getPath([1,0,2])).toBe(1);

  expect(offspring.getPath([1])).toHaveLength(3);
  expect(offspring.getPath([1,0,1])).toBe(1);
  expect(offspring.getPath([1,1,1])).toBe(2);

});