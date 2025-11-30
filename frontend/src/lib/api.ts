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
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: any }>("/auth/login", {
      email,
      password,
    }),
  register: (name: string, email: string, password: string) =>
    api.post("/auth/register", { name, email, password }),
  getProfile: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

// Users API
export const usersApi = {
  getAll: () => api.get("/users"),
  getById: (id: number) => api.get(`/users/${id}`),
  updateRole: (id: number, role: "USER" | "ADMIN") =>
    api.patch(`/users/${id}/role`, { role }),
  delete: (id: number) => api.delete(`/users/${id}`),
  changePassword: (data: {currentPassword: string, newPassword: string}) =>
    api.put(`/users/password-change`, data),
};

// Attendance API
export const attendanceApi = {
  mark: (data: { status: "WFO" | "WFH" | "CL" | "SL" | "COMP_OFF" | "AB" }) =>
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
};

// Leaves API
export const leavesApi = {
  apply: (data: {
    type: "SICK" | "CASUAL" | "EARNED" | "COMP_OFF" | "LOP";
    fromDate: string;
    toDate: string;
    reason: string;
  }) => api.post("/leaves/apply", data),

  getMyLeaves: () => api.get("/leaves/my-leaves"),

  getPendingLeaves: () => api.get("/leaves/all"),

  getApprovedLeaves: (params: { type: "approvedLeaves" }) =>
    api.get("/leaves/all", { params }),

  getManagerApprovalLeaves: (managerId: number) =>
    api.get(`/leaves/requests?managerId=${managerId}`),

  getLeavesByUser: (userId: number) => api.get(`/leaves/user/${userId}`),

  approveLeave: (id: number) => api.post(`/leaves/approve/${id}`),

  rejectLeave: (id: number) => api.post(`/leaves/reject/${id}`),

  approveManagerLeave: (id: number) =>
    api.post(`/leaves/manager-approve/${id}`),

  rejectManagerLeave: (id: number) => api.post(`/leaves/manager-reject/${id}`),

  cancelLeave: (id: number) => api.delete(`/leaves/cancel/${id}`),
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
