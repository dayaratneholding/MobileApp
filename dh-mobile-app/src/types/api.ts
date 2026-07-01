export type ApiResult<T> = {
  succeeded: boolean;
  messages?: string[] | null;
  data?: T | null;
  code?: number;
};

export type UserCompany = {
  comSerialID: number;
  comName: string;
  comCode: string;
};

export type GetUserCompaniesQuery = {
  userID: string;
  active?: boolean;
  isDelete?: boolean;
  serialID?: number | null;
};

export type LoginData = {
  token?: string | null;
  imageProfileUrl?: string | null;
  isAuthorized?: boolean;
  imageCompanyUrl?: string | null;
  iconCompanyUrl?: string | null;
  userName?: string | null;
  userID?: string | null;
  eESerialID?: number | null;
  comSerialID?: number | null;
  expires?: number;
  refreshToken?: string | null;
  refreshTokenExpiration?: string | null;
};

export type AuthSession = {
  token: string;
  refreshToken?: string | null;
  refreshTokenExpiration?: string | null;
  userName: string;
  userID: string;
  comSerialID: number;
  companyName: string;
  companyCode: string;
  eESerialID?: number | null;
  isAuthorized: boolean;
  imageProfileUrl?: string | null;
  imageCompanyUrl?: string | null;
  iconCompanyUrl?: string | null;
};
