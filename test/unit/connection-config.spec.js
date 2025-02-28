const assert = require("assert");

const mysql = require("../index");

describe("Test a connection config", () => {
  it("Should get a valid connection config when a config is passed in", () => {
    const configs = [
      mysql({
        config: {
          host: "localhost",
          database: "database",
          user: "user",
          password: "password",
        },
      }).getConfig(),
      mysql().config({
        host: "localhost",
        database: "database",
        user: "user",
        password: "password",
      }),
    ];

    configs.forEach((config) => {
      assert.deepEqual(config, {
        host: "localhost",
        database: "database",
        user: "user",
        password: "password",
      });
    });
  });

  it("Should get a valid connection config when a connection string is passed in", () => {
    const configs = [
      mysql("mysql://user:password@localhost:3306/database").getConfig(),
      mysql().config("mysql://user:password@localhost:3306/database"),
    ];

    configs.forEach((config) => {
      assert.deepEqual(config, {
        host: "localhost",
        database: "database",
        user: "user",
        password: "password",
        port: "3306",
      });
    });
  });

  it("Should throw an exception when an invalid connection string is passed in", () => {
    assert.throws(() => mysql("mysql://:3306/database").getConfig());
    assert.throws(() => mysql("mysql://:3306").getConfig());
  });
});
