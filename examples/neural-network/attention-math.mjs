// Rows are tokens. All projections use the convention P = X W.
export const tokens = ['A', 'B', 'C'];
export const inputs = [
  [1, 0],
  [0, 1],
  [1, 1],
];
export const projections = {
  Q: [
    [1, 0],
    [0, 1],
  ],
  K: [
    [1, 1],
    [0, 1],
  ],
  V: [
    [2, 0],
    [0, 1],
  ],
};

export function dot(left, right) {
  return left.reduce((sum, value, i) => sum + value * right[i], 0);
}
function transpose(matrix) {
  return matrix[0].map((_, j) => matrix.map((row) => row[j]));
}
function product(left, right) {
  const columns = transpose(right);
  return left.map((row) => columns.map((column) => dot(row, column)));
}

export function attention(row = 2, causal = false, X = inputs, W = projections) {
  const Q = product(X, W.Q),
    K = product(X, W.K),
    V = product(X, W.V);
  const scale = Math.sqrt(Q[row].length);
  const raw = K.map((key) => dot(Q[row], key));
  const scores = raw.map((value, j) => (causal && j > row ? -Infinity : value / scale));
  const maximum = Math.max(...scores);
  const exp = scores.map((value) => Math.exp(value - maximum));
  const total = exp.reduce((a, b) => a + b, 0);
  const weights = exp.map((value) => value / total);
  const [output] = product([weights], V);
  const g = [output[0] - 1, 0];
  const loss = 0.5 * g[0] ** 2;
  const dV = weights.map((weight) => g.map((value) => weight * value));
  const da = V.map((value) => dot(g, value));
  const mean = dot(weights, da);
  const ds = weights.map((weight, j) => weight * (da[j] - mean));
  const [queryGrad] = product([ds.map((d) => d / scale)], K);
  const dQ = Q.map((query, i) => query.map((_, j) => (i === row ? queryGrad[j] : 0)));
  const dK = ds.map((d) => Q[row].map((value) => (d * value) / scale));
  const projectedGrads = { Q: dQ, K: dK, V: dV };
  const dW = {},
    inputPaths = {};
  for (const name of Object.keys(projectedGrads)) {
    dW[name] = product(transpose(X), projectedGrads[name]);
    inputPaths[name] = product(projectedGrads[name], transpose(W[name]));
  }
  const dX = X.map((x, i) => x.map((_, j) => inputPaths.Q[i][j] + inputPaths.K[i][j] + inputPaths.V[i][j]));
  return { Q, K, V, raw, scores, weights, output, g, loss, dV, da, mean, ds, dQ, dK, dW, dX, inputPaths };
}
