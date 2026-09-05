const Joi = require('joi');

const createPostSchema = Joi.object({
  content: Joi.string().trim().max(2000).default('').allow(''),
  category: Joi.string().trim().max(80).default('General'),
  is_anonymous: Joi.boolean().default(false),
  group_id: Joi.string().uuid().optional().allow(null),
  post_type: Joi.string().valid('text', 'video', 'photo').default('text'),
  image_url: Joi.string().trim().max(2000).optional().allow(null, ''),
  video_url: Joi.string().trim().max(2000).optional().allow(null, ''),
  thumbnail_url: Joi.string().trim().max(2000).optional().allow(null, ''),
}).custom((value, helpers) => {
  const content = (value.content || '').trim();
  const videoUrl = (value.video_url || '').trim();
  const imageUrl = (value.image_url || '').trim();

  if (videoUrl && imageUrl) {
    return helpers.message('Add either a photo or a video, not both');
  }

  if (videoUrl) {
    value.post_type = 'video';
    value.video_url = videoUrl;
    value.content = content;
    return value;
  }

  if (imageUrl) {
    value.post_type = 'photo';
    value.image_url = imageUrl;
    value.content = content;
    return value;
  }

  value.post_type = 'text';
  if (content.length < 10) {
    return helpers.message('Write at least 10 characters or add a photo/video');
  }
  return value;
});

const createCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).required(),
});

const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(3).max(80).required(),
  description: Joi.string().trim().max(500).default(''),
  icon: Joi.string().trim().max(40).default('account-group'),
  weekly_topic: Joi.string().trim().max(200).optional().allow('', null),
});

const addGroupMemberSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
});

const createChallengeSchema = Joi.object({
  title: Joi.string().trim().min(3).max(100).required(),
  description: Joi.string().trim().max(500).default(''),
  icon: Joi.string().trim().max(40).default('trophy'),
  color: Joi.string().trim().max(20).default('#0B6E72'),
  target: Joi.number().integer().min(1).max(1000000).default(100),
  unit: Joi.string().trim().max(30).default('steps'),
  duration_days: Joi.number().integer().min(1).max(90).default(7),
  xp_reward: Joi.number().integer().min(0).max(10000).default(100),
  badge_name: Joi.string().trim().max(60).default('Achiever'),
});

const updateProgressSchema = Joi.object({
  progress: Joi.number().integer().min(0).required(),
});

const addBuddySchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  relation: Joi.string()
    .valid('friend', 'family', 'partner', 'workout')
    .default('friend'),
});

const reportContentSchema = Joi.object({
  reason: Joi.string()
    .valid(
      'harmful_medical_advice',
      'harassment_or_hate',
      'inappropriate_adult_content',
      'spam_or_scam',
      'misinformation',
      'violence_or_dangerous',
      'other',
    )
    .required(),
  details: Joi.string().max(500).allow('', null).optional(),
});

module.exports = {
  createPostSchema,
  createCommentSchema,
  createGroupSchema,
  addGroupMemberSchema,
  createChallengeSchema,
  updateProgressSchema,
  addBuddySchema,
  reportContentSchema,
};
