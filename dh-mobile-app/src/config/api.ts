export const API_BASE_URL = 'http://2.24.130.171:7001';
export const API_HCM_URL = 'http://52.172.28.123:8002';
// export const API_HCM_URL = 'http://192.168.1.207:8071';

// export const API_PREFIX = '/api/v1/core';
// export const HCM_API_PREFIX = '/api/v1/hcm';

// export const API_URL = `${API_BASE_URL}${API_PREFIX}`;
// export const HCM_API_URL = `${API_HCM_URL}${HCM_API_PREFIX}`;
// export const MOBILE_APP_API_URL = `${API_HCM_URL}/api/MobileApp`;

// FOR LIVE/PRODUCTION (Cloudflare HTTPS Subdomains)
// export const API_BASE_URL = 'https://core.prasuking.com';
// export const API_HCM_URL = 'https://hcm.prasuking.com';

export const API_PREFIX = '/api/v1/core';
export const HCM_API_PREFIX = '/api/v1/hcm';

export const API_URL = `${API_BASE_URL}${API_PREFIX}`;          // Resolves to: https://core.prasuking.com/api/v1/core
export const HCM_API_URL = `${API_HCM_URL}${HCM_API_PREFIX}`;    // Resolves to: https://hcm.prasuking.com/api/v1/hcm
export const MOBILE_APP_API_URL = `${API_HCM_URL}/api/MobileApp`; // Resolves to: https://hcm.prasuking.com/api/v1/MobileApp