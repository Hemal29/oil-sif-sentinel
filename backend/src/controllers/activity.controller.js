"use strict";

const { makeMasterController } = require("./master.controller");
const activityService = require("../services/activity.service");

module.exports = makeMasterController(activityService, "activity");
