// src/config/constants.js
export const RUNPOD_ENDPOINT = process.env.REACT_APP_RUNPOD_ENDPOINT;
export const RUNPOD_API_KEY = process.env.REACT_APP_RUNPOD_API_KEY;
export const BUCKET_NAME = 'llm_docs';
export const URL_EXPIRY = 31536000; // 1 year in seconds

export const ROLES = ['Admin', 'Art Team', 'Internal Rep', 'External Rep'];