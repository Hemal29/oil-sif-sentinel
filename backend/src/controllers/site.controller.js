"use strict";

const { makeMasterController } = require("./master.controller");
const siteService = require("../services/site.service");

module.exports = makeMasterController(siteService, "site");
