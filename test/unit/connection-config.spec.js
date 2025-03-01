const assert = require("assert");
const mysql = require("../../index");

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
        port: 3306,
      });
    });
  });

  it("Should throw an exception when an invalid connection string is passed in", () => {
    assert.throws(() => mysql("mysql://:3306/database").getConfig());
    assert.throws(() => mysql("mysql://:3306").getConfig());
  });

  it("Should throw an error with an invalid connection string format", () => {
    assert.throws(() => {
      mysql("invalid-connection-string");
    }, /Invalid data source URL provided/);
  });

  it("Should throw an error with a malformed connection string", () => {
    assert.throws(() => {
      mysql("mysql://user:password@");
    }, /Invalid data source URL provided/);
  });

  it("Should handle connection string with missing credentials gracefully", () => {
    const db = mysql("mysql://localhost:3306/");
    const config = db.getConfig();

    assert.strictEqual(config.host, "localhost");
    assert.strictEqual(config.port, 3306);
  });

  it("Should parse additional parameters from connection string", () => {
    const db = mysql("mysql://user:password@localhost:3306/database?dateStrings=true");
    const config = db.getConfig();

    assert.strictEqual(config.host, "localhost");
    assert.strictEqual(config.database, "database");
    assert.strictEqual(config.user, "user");
    assert.strictEqual(config.password, "password");
    assert.strictEqual(config.port, 3306);
    assert.strictEqual(config.dateStrings, "true");
  });
});
