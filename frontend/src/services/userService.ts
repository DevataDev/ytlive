import { api } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export const userService = {
  // Get all users with pagination
  async getUsers(page: number = 1, limit: number = 10, search: string = ''): Promise<UserListResponse> {
    const response = await api.get<UserListResponse>(`/api/users?page=${page}&per_page=${limit}&search=${search}`);
    console.dir(response)
    return response;
  },

  // Create a new user
  async createUser(userData: CreateUserData): Promise<User> {
    const response = await api.post<User>('/users', userData);
    return response.data;
  },

  // Update a user
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    const response = await api.put<User>(`/users/${userId}`, userData);
    return response.data;
  },

  // Update user password
  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    await api.patch(`/users/${userId}/password`, { newPassword });
  },

  // Delete a user
  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/users/${userId}`);
  },

  // Toggle user active status
  async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    const response = await api.patch<User>(`/users/${userId}/status`, { isActive });
    return response.data;
  },
};
