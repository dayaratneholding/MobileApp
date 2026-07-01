import { postLogin } from '../client/loginClient';
import type { AuthSession, UserCompany } from '../../types/api';

type LoginParams = {
  userID: string;
  comSerialID: number;
  password: string;
  company: UserCompany;
};

export async function login({
  userID,
  comSerialID,
  password,
  company,
}: LoginParams): Promise<AuthSession> {
  const result = await postLogin({
    UserID: userID.trim(),
    ComSerialID: Number(comSerialID),
    Password: password,
  });

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Login failed.');
  }

  const data = result.data;
  if (!data?.token) {
    throw new Error('Login succeeded but no token was returned.');
  }

  if (data.isAuthorized === false) {
    throw new Error('You are not authorized to access this company.');
  }

  return {
    token: data.token,
    refreshToken: data.refreshToken,
    refreshTokenExpiration: data.refreshTokenExpiration,
    userName: data.userName ?? userID.trim(),
    userID: data.userID ?? userID.trim(),
    comSerialID: data.comSerialID ?? comSerialID,
    companyName: company.comName,
    companyCode: company.comCode,
    eESerialID: data.eESerialID,
    isAuthorized: data.isAuthorized ?? true,
    imageProfileUrl: data.imageProfileUrl,
    imageCompanyUrl: data.imageCompanyUrl,
    iconCompanyUrl: data.iconCompanyUrl,
  };
}
