"use strict";

const { makeMasterService } = require("./master.service");
const LifeSavingRule = require("../models/LifeSavingRule");

module.exports = makeMasterService(LifeSavingRule, "LifeSavingRule");
