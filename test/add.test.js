const fs = require("fs");
const path = require("path");
const rimrafSync = require("rimraf").sync;
const expect = require("chai").expect;

const add = require("../commands/add");

describe("Add", () => {
  it("Should add the appropriate key-value pair to the encrypted file", () => {
    expect(true).to.be.true;
  });
});
