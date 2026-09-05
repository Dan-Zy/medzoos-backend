const Joi = require('joi');

const sendMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
});

const triageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
  answers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
});

module.exports = { sendMessageSchema, triageSchema };
