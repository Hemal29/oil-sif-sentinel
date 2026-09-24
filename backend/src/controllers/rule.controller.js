"use strict";

const { makeMasterController } = require("./master.controller");
const ruleService = require("../services/rule.service");

module.exports = makeMasterController(ruleService, "rule");
