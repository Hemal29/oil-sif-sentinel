"use strict";

const { Op } = require("sequelize");
const { AppError } = require("../utils/errors");
const { getPagination } = require("../utils/pagination");

// Shared CRUD for Site / Activity / LifeSavingRule master collections.
function makeMasterService(Model, resourceName) {
  function duplicateError(err) {
    if (err && err.name === "SequelizeUniqueConstraintError") {
      throw new AppError(`${resourceName} code already exists`, 409, "DUPLICATE_CODE");
    }
    throw err;
  }

  async function create(data) {
    try {
      return await Model.create(data);
    } catch (err) {
      return duplicateError(err);
    }
  }

  async function list(query = {}) {
    const { page, limit, skip } = getPagination(query);
    const where = {};
    if (query.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${query.search}%` } },
        { code: { [Op.like]: `%${query.search}%` } },
      ];
    }
    if (query.status) where.status = query.status;
    const { rows, count } = await Model.findAndCountAll({
      where,
      limit,
      offset: skip,
      order: [["createdAt", "DESC"]],
    });
    return {
      items: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  }

  async function getById(id) {
    const record = await Model.findByPk(id);
    if (!record) throw new AppError(`${resourceName} not found`, 404, "NOT_FOUND");
    return record;
  }

  async function update(id, data) {
    const record = await getById(id);
    try {
      return await record.update(data);
    } catch (err) {
      return duplicateError(err);
    }
  }

  return { create, list, getById, update };
}

module.exports = { makeMasterService };
