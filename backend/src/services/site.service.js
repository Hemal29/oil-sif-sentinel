"use strict";

const { makeMasterService } = require("./master.service");
const Site = require("../models/Site");

module.exports = makeMasterService(Site, "Site");
