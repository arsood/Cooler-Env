module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+.ts?$": ["ts-jest", {}],
    "^.+\\.(js)$": "babel-jest",
  },
};
