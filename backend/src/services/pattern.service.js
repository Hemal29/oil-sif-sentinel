"use strict";

const { makeMasterService } = require("./master.service");
const Pattern = require("../models/Pattern");

module.exports = makeMasterService(Pattern, "Pattern");
