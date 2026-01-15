import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import env from "./env";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.api.baseUrl,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        "X-Application-Name": env.app.name,
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth_token");
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const api = new ApiClient();

// Auth API
export const authApi = {
  login: (email: string, password: string, rememberMe?: boolean) =>
    api.post<{ access_token: string; user: any }>("/auth/login", {
      email,
      password,
      rememberMe,
    }),
  register: (name: string, email: string, password: string, avatar?: string) =>
    api.post("/auth/register", { name, email, password, avatar }),
  getProfile: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

export const adminDashboardApi = {
  getStats: () => api.get('/admin-dashboard/stats'),
  getTrends: (period: string) => api.get(`/admin-dashboard/trends?period=${period}`),
  getActivity: () => api.get('/admin-dashboard/activity'),
};

// Users API
export const usersApi = {
  getAll: (data: { page: number; limit: number, search: string }) =>
    api.get("/users", {
      params: {
        page: data.page,
        limit: data.limit,
        search: data.search,
      },
    }),
  updateUser: (data: { name: string }) =>
    api.put(`/users/editProfile`, data),
  getById: (id: number) => api.get(`/users/${id}`),
  update: (variables: { id: number; email: string; role: 'USER' | 'MANAGER' | 'ADMIN'; managerId?: number | null, avatar?: string }) =>
    api.put(`/users/${variables.id}/update`, {
      email: variables.email,
      role: variables.role,
      managerId: variables.managerId ?? null,
    }),
  delete: (id: number) => api.delete(`/users/${id}/delete`),
  changePassword: (data: { currentPassword: string, newPassword: string }) =>
    api.put(`/users/password-change`, data),
  create: (data: {
    name: string;
    email: string;
    password: string;
    role?: "USER" | "MANAGER" | "ADMIN";
    managerId?: number | null;
    avatar?: string;
  }) => api.post("/users", data),
  getManagers: () => api.get("/users/managers"),
  updateAvatar: (avatar: string) => api.put("/users/avatar", { avatar }),
};

// Attendance API
export const attendanceApi = {
  mark: (data: { status: "WFO" | "WFH" | "CL" | "SL" | "EL" | "COMP_OFF" | "AB" | "OL" | "ML" }) =>
    api.post("/attendance/mark", data),
  getMyAttendance: (month?: number, year?: number) => {
    const params: { month?: number; year?: number } = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return api.get("/attendance/my", { params });
  },
  getSummary: () => api.get("/attendance/summary"),
  getByDate: (date: string) =>
    api.get("/attendance/date", { params: { date } }),
  getAll: (params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    date?: string;
  }): Promise<{
    data: any[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> => api.get("/attendance/list", { params }),
  adminMarkAttendance: (data: {
    userId: number;
    date: string;
    status: "WFO" | "WFH" | "CL" | "SL" | "EL" | "COMP_OFF" | "AB" | "OL" | "ML";
  }) => api.post("/attendance/admin/mark", data),
};

// Leaves API
export const leavesApi = {
  getAll: (params: any) => api.get("/leaves/list", { params }),
  apply: (data: {
    type: "SICK" | "CASUAL" | "EARNED" | "COMP_OFF" | "LOP" | "OPTIONAL";
    fromDate: string;
    toDate: string;
    reason: string;
  }) => api.post("/leaves/apply", data),

  getMyLeaves: (params: any) =>
    api.get("/leaves/my-leaves", { params }),

  getPendingLeaves: () => api.get("/leaves/all"),

  getApprovedLeaves: (params: { type: "MANAGER_APPROVED" }) =>
    api.get("/leaves/all", { params }),

  getManagerApprovalLeaves: (params: any) =>
    api.get(`/leaves/requests?managerId=${params?.managerId}`, { params }),

  getLeavesByUser: (userId: number) => api.get(`/leaves/user/${userId}`),

  approveLeave: (id: number) => api.post(`/leaves/approve/${id}`),

  rejectLeave: (id: number) => api.post(`/leaves/reject/${id}`),

  approveManagerLeave: (id: number) =>
    api.post(`/leaves/manager-approve/${id}`),

  rejectManagerLeave: (id: number) => api.post(`/leaves/manager-reject/${id}`),

  cancelLeave: (id: number) => api.delete(`/leaves/cancel/${id}`),
  getBalance: () => api.get("/leaves/balance"),
  revokeLeave: (id: number) => api.post(`/leaves/revoke/${id}`),
  getRecentActivity: () => api.get("/leaves/recent-activity"),
  requestCancellation: (id: number, reason: string) => api.post(`/leaves/${id}/request-cancellation`, { reason }),
  approveCancellation: (id: number) => api.post(`/leaves/${id}/approve-cancellation`),
  rejectCancellation: (id: number, comments?: string) => api.post(`/leaves/${id}/reject-cancellation`, { comments }),
  getAdminLeaveRequests: (params: any) => api.get("/leaves/admin-requests", { params }),
  approveAdminLeave: (id: number) => api.post(`/leaves/ceo-approve/${id}`),
  rejectAdminLeave: (id: number, comments?: string) => api.post(`/leaves/ceo-reject/${id}`, { comments }),
};

// Reports API
export const reportsApi = {
  getAttendanceReport: (params: {
    userId?: number;
    startDate: string;
    endDate: string;
  }) => api.get("/reports/attendance", { params }),

  getLeavesReport: (params: {
    userId?: number;
    startDate: string;
    endDate: string;
    status?: "PENDING" | "APPROVED" | "REJECTED";
  }) => api.get("/reports/leaves", { params }),
};

// Team API
export const teamApi = {
  getTree: (mode: 'FULL' | 'MY_TEAM') =>
    api.get(mode === 'FULL' ? '/team/tree' : '/team/my-team'),
  getStatus: () => api.get('/team/status/today'),
};
