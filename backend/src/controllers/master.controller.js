"use strict";

const { ok, created } = require("../utils/apiResponse");

// Shared thin CRUD controller for master collections.
function makeMasterController(service, resourceName) {
  async function create(req, res, next) {
    try {
      const record = await service.create(req.body);
      return created(res, { [resourceName]: record }, `${resourceName} created`);
    } catch (err) {
      return next(err);
    }
  }

  async function list(req, res, next) {
    try {
      const result = await service.list(req.query);
      return ok(res, result, `${resourceName} list`);
    } catch (err) {
      return next(err);
    }
  }

  async function getById(req, res, next) {
    try {
      const record = await service.getById(req.params.id);
      return ok(res, { [resourceName]: record }, `${resourceName} details`);
    } catch (err) {
      return next(err);
    }
  }

  async function update(req, res, next) {
    try {
      const record = await service.update(req.params.id, req.body);
      return ok(res, { [resourceName]: record }, `${resourceName} updated`);
    } catch (err) {
      return next(err);
    }
  }

  return { create, list, getById, update };
}

module.exports = { makeMasterController };
