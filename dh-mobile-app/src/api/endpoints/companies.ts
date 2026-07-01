import { postJson } from '../client/client';
import type {
  ApiResult,
  GetUserCompaniesQuery,
  UserCompany,
} from '../../types/api';

export async function getUserCompanies(
  userID: string,
): Promise<UserCompany[]> {
  const payload: GetUserCompaniesQuery = {
    userID: userID.trim(),
    active: true,
    isDelete: false,
  };

  const result = await postJson<ApiResult<UserCompany[]>, GetUserCompaniesQuery>(
    '/Companies/getusercompanies',
    payload,
  );

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to load companies.');
  }

  return result.data ?? [];
}
