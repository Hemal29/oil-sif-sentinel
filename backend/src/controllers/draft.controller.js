"use strict";

const draftService = require("../services/draft.service");
const { ok, created } = require("../utils/apiResponse");

async function create(req, res, next) {
  try {
    const draft = await draftService.createDraft(req.body, req.user.id);
    return created(res, { draft }, "Draft saved");
  } catch (err) { return next(err); }
}
async function list(req, res, next) {
  try {
    const result = await draftService.listDrafts(req.query, req.user.id);
    return ok(res, result, "Drafts list");
  } catch (err) { return next(err); }
}
async function getById(req, res, next) {
  try {
    const draft = await draftService.getDraft(req.params.id, req.user.id);
    return ok(res, { draft }, "Draft");
  } catch (err) { return next(err); }
}
async function update(req, res, next) {
  try {
    const draft = await draftService.updateDraft(req.params.id, req.user.id, req.body);
    return ok(res, { draft }, "Draft updated");
  } catch (err) { return next(err); }
}
async function remove(req, res, next) {
  try {
    await draftService.deleteDraft(req.params.id, req.user.id);
    return ok(res, {}, "Draft deleted");
  } catch (err) { return next(err); }
}
async function submit(req, res, next) {
  try {
    const report = await draftService.submitDraft(req.params.id, req.user.id);
    return created(res, { report }, "Report submitted");
  } catch (err) { return next(err); }
}

module.exports = { create, list, getById, update, remove, submit };
