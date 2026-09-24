"use strict";

const { makeMasterService } = require("./master.service");
const Activity = require("../models/Activity");

module.exports = makeMasterService(Activity, "Activity");
