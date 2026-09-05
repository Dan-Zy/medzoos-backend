/**
 * General Health & Preventive Wellness Taxonomy
 */

const GENERAL_HEALTH_TOPICS = {
  vitals: {
    name: 'vitals',
    title: 'Vital Signs & Health Measurements',
    description: 'Blood pressure, pulse rate, oxygen saturation, temperature, and BMI guidelines.',
    subtopics: ['blood_pressure', 'heart_rate', 'body_temperature', 'oxygen_saturation', 'bmi_weight'],
    synonyms: [
      'bp range', 'blood pressure normal', 'pulse rate', 'body temperature',
      'heart rate normal', 'bmi check', 'normal vitals'
    ]
  },
  hydration: {
    name: 'hydration',
    title: 'Hydration & Daily Water Intake',
    description: 'Hydration guidelines, water requirements in hot climates, and electrolyte balance.',
    subtopics: ['daily_water_intake', 'summer_hydration', 'signs_of_dehydration', 'electrolytes'],
    synonyms: [
      'water intake', 'pani kitna peena chahiye', 'hydration tips',
      'dehydration symptoms', 'pani ki kami'
    ]
  },
  sleep_hygiene: {
    name: 'sleep_hygiene',
    title: 'General Sleep Hygiene & Rest',
    description: 'Circadian rhythm, restorative sleep, screen time limits, and sleep duration.',
    subtopics: ['recommended_sleep_hours', 'sleep_environment', 'screen_time_rules'],
    synonyms: [
      'sleep hygiene', 'achhi neend', 'how many hours sleep',
      'sleep routine general', 'neend ke usool'
    ]
  },
  routine_screening: {
    name: 'routine_screening',
    title: 'Preventive Health Checkups & Screening',
    description: 'Age-appropriate health checkups, blood tests, and annual wellness examinations.',
    subtopics: ['annual_health_check', 'cbc_screening', 'lipid_screening', 'age_specific_tests'],
    synonyms: [
      'annual checkup', 'general health check', 'routine blood test',
      'body checkup package', 'preventive tests'
    ]
  },
  nutrition_basics: {
    name: 'nutrition_basics',
    title: 'Balanced Nutrition & Healthy Eating',
    description: 'Macro/micronutrients, dietary fiber, reducing processed sugars, and local dietary balance.',
    subtopics: ['balanced_plate', 'dietary_fiber', 'portion_control', 'vitamins_minerals'],
    synonyms: [
      'healthy diet', 'balanced food', 'sehat mand khana',
      'daily nutrition tips', 'vitamins food'
    ]
  },
  physical_activity: {
    name: 'physical_activity',
    title: 'General Physical Activity & Fitness',
    description: 'WHO recommended activity guidelines (150 mins/week moderate activity), step counts.',
    subtopics: ['who_activity_guidelines', 'daily_steps_target', 'sedentary_behavior_reduction'],
    synonyms: [
      'daily walk', 'how much exercise daily', '10000 steps',
      'exercise tips general', 'fitness routine'
    ]
  },
  immunity: {
    name: 'immunity',
    title: 'Immune Health & Wellness Habits',
    description: 'Natural immune support through nutrition, sleep, vitamin D, and vaccination basics.',
    subtopics: ['immune_support_nutrition', 'vitamin_d_sunlight', 'vaccination_awareness'],
    synonyms: [
      'immunity boost', 'quwwat e mudafiat', 'immune system strong',
      'vitamin d sunlight', 'immunity tips'
    ]
  },
  fever_cold_basics: {
    name: 'fever_cold_basics',
    title: 'Common Cold & Mild Seasonal Symptom Care',
    description: 'Basic supportive care for seasonal cough, cold, hydration, and when to see a doctor.',
    subtopics: ['home_fluids', 'steam_inhalation', 'when_to_see_gp', 'viral_vs_bacterial_awareness'],
    synonyms: [
      'nazla zukam', 'common cold tips', 'seasonal flu care',
      'gala kharab', 'halka bukhar home care'
    ]
  }
};

module.exports = {
  DOMAIN: 'general_health',
  TOPICS: GENERAL_HEALTH_TOPICS,
  TOPIC_KEYS: Object.keys(GENERAL_HEALTH_TOPICS),
};
