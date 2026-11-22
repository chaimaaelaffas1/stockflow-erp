import type { Paginated, User } from "@/types/api";
import type { Role } from "@/lib/permissions";
import { api, clean } from "./client";

export interface UserInput {
  email: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  is_active: boolean;
  password?: string;
}
export const usersApi = {
  list: (params: { page?: number; page_size?: number } = {}) =>
    api.get<Paginated<User>>("/users/", { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<User>(`/users/${id}/`).then((r) => r.data),
  create: (body: UserInput) => api.post<User>("/users/", body).then((r) => r.data),
  // PATCH (et non PUT) : le mot de passe est obligatoire en PUT mais facultatif en PATCH.
  update: (id: number, body: Partial<UserInput>) => api.patch<User>(`/users/${id}/`, body).then((r) => r.data),
};
