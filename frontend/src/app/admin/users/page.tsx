"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  Phone,
  Search,
  Shield,
  User,
  Briefcase,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/components/providers/language-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  roles: string[];
  enabled: boolean;
  createdAt: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-700 border-purple-200/90",
  MANAGER: "bg-amber-50 text-amber-800 border-amber-200/90",
  CUSTOMER: "bg-sky-50 text-sky-700 border-sky-200/90",
};

const COPY = {
  vi: {
    breadcrumb: "Admin",
    title: "Quản lý người dùng",
    subtitle: "Rà soát vai trò, trạng thái và hồ sơ khách hàng trong hệ thống.",
    totalUsers: "Tổng người dùng",
    active: "Đang hoạt động",
    inactive: "Đã vô hiệu",
    admins: "Quản trị viên",
    searchPlaceholder: "Tìm kiếm theo tên hoặc email...",
    roleFilter: "Lọc theo vai trò",
    statusFilter: "Lọc theo trạng thái",
    allRoles: "Tất cả vai trò",
    allStatus: "Tất cả trạng thái",
    activeStatus: "Hoạt động",
    inactiveStatus: "Vô hiệu",
    tableUser: "Người dùng",
    tableRole: "Vai trò",
    tableStatus: "Trạng thái",
    tableJoined: "Ngày tham gia",
    tableAction: "Hành động",
    empty: "Không tìm thấy người dùng phù hợp.",
    page: "Trang {current} / {total}",
    prev: "Trước",
    next: "Sau",
    detailTitle: "Chi tiết người dùng",
    activate: "Kích hoạt",
    deactivate: "Vô hiệu hóa",
    activateSuccess: "Đã kích hoạt tài khoản.",
    activateError: "Không thể kích hoạt tài khoản.",
    deactivateSuccess: "Đã vô hiệu hóa tài khoản.",
    deactivateError: "Không thể vô hiệu hóa tài khoản.",
    disableConfirm: 'Bạn có chắc muốn vô hiệu hóa tài khoản "{name}" không?',
    roleLabels: {
      ADMIN: "Quản trị viên",
      MANAGER: "Quản lý",
      CUSTOMER: "Khách hàng",
    },
  },
  en: {
    breadcrumb: "Admin",
    title: "User management",
    subtitle:
      "Review account roles, states, and customer profiles in the system.",
    totalUsers: "Total users",
    active: "Active",
    inactive: "Inactive",
    admins: "Admins",
    searchPlaceholder: "Search by name or email...",
    roleFilter: "Filter by role",
    statusFilter: "Filter by status",
    allRoles: "All roles",
    allStatus: "All statuses",
    activeStatus: "Active",
    inactiveStatus: "Inactive",
    tableUser: "User",
    tableRole: "Role",
    tableStatus: "Status",
    tableJoined: "Joined",
    tableAction: "Action",
    empty: "No users match the current filter.",
    page: "Page {current} / {total}",
    prev: "Previous",
    next: "Next",
    detailTitle: "User details",
    activate: "Activate",
    deactivate: "Disable",
    activateSuccess: "Account activated successfully.",
    activateError: "Unable to activate the account.",
    deactivateSuccess: "Account disabled successfully.",
    deactivateError: "Unable to disable the account.",
    disableConfirm: 'Are you sure you want to disable "{name}"?',
    roleLabels: {
      ADMIN: "Admin",
      MANAGER: "Manager",
      CUSTOMER: "Customer",
    },
  },
} as const;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const {
    isAuthenticated,
    isAdmin,
    isLoading: isAuthLoading,
  } = useAuth(true, true);
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading } = useQuery<PageResponse<UserRecord>>({
    queryKey: ["admin-users", page, search, roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: "10",
      });

      if (search) {
        params.set("keyword", search);
      }

      if (roleFilter) {
        params.set("role", roleFilter);
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const endpoint = search ? "/admin/users/search" : "/admin/users";
      const response = await api.get(`${endpoint}?${params.toString()}`);
      return response.data;
    },
    retry: false,
  });

  const activateMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.put(`/admin/users/${userId}/activate`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(copy.activateSuccess);
    },
    onError: () => {
      toast.error(copy.activateError);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.put(`/admin/users/${userId}/deactivate`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(copy.deactivateSuccess);
    },
    onError: () => {
      toast.error(copy.deactivateError);
    },
  });

  if (isAuthLoading || !isAuthenticated || !isAdmin) {
    return null;
  }

  const users = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  const roleOptions = [
    { value: "all", label: copy.allRoles },
    { value: "ADMIN", label: copy.roleLabels.ADMIN },
    { value: "MANAGER", label: copy.roleLabels.MANAGER },
    { value: "CUSTOMER", label: copy.roleLabels.CUSTOMER },
  ];

  const statusOptions = [
    { value: "all", label: copy.allStatus },
    { value: "active", label: copy.activeStatus },
    { value: "inactive", label: copy.inactiveStatus },
  ];

  const activeCount = users.filter((user) => user.enabled).length;
  const inactiveCount = users.filter((user) => !user.enabled).length;
  const adminCount = users.filter((user) =>
    user.roles.includes("ADMIN"),
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50/30">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <Link
              href="/admin"
              className="hover:text-blue-600 transition-colors"
            >
              {copy.breadcrumb}
            </Link>
            <span>/</span>
            <span className="font-medium text-gray-900">{copy.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{copy.title}</h1>
          <p className="mt-2 text-gray-600">{copy.subtitle}</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          {[
            {
              label: copy.totalUsers,
              value: totalElements,
              icon: Users,
              tone: "bg-blue-100 text-blue-600",
            },
            {
              label: copy.active,
              value: activeCount,
              icon: UserCheck,
              tone: "bg-green-100 text-green-600",
            },
            {
              label: copy.inactive,
              value: inactiveCount,
              icon: UserX,
              tone: "bg-gray-100 text-gray-600",
            },
            {
              label: copy.admins,
              value: adminCount,
              icon: Shield,
              tone: "bg-purple-100 text-purple-600",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-2xl border-0 shadow-lg">
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{item.label}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {item.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mb-6 rounded-2xl border-0 shadow-lg">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder={copy.searchPlaceholder}
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter || "all"}
              onValueChange={(value) => {
                setRoleFilter(value === "all" ? "" : value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder={copy.roleFilter} />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => {
                setStatusFilter(value === "all" ? "" : value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder={copy.statusFilter} />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/60">
                  <TableHead>#</TableHead>
                  <TableHead>{copy.tableUser}</TableHead>
                  <TableHead>{copy.tableRole}</TableHead>
                  <TableHead>{copy.tableStatus}</TableHead>
                  <TableHead>{copy.tableJoined}</TableHead>
                  <TableHead className="text-right">
                    {copy.tableAction}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-14 text-center text-gray-500"
                    >
                      {copy.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, index) => (
                    <TableRow key={user.id} className="hover:bg-gray-50/50">
                      <TableCell className="text-sm text-gray-500">
                        {page * 10 + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                            {user.fullName?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.fullName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <span
                              key={role}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors",
                                ROLE_STYLES[role] || "bg-gray-50 text-gray-700 border-gray-200",
                              )}
                            >
                              {role === "ADMIN" ? (
                                <Shield className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                              ) : role === "MANAGER" ? (
                                <Briefcase className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                              ) : (
                                <User className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                              )}
                              <span>
                                {copy.roleLabels[
                                  role as keyof typeof copy.roleLabels
                                ] || role}
                              </span>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.enabled
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }
                        >
                          {user.enabled
                            ? copy.activeStatus
                            : copy.inactiveStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString(
                          locale === "vi" ? "vi-VN" : "en-US",
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={copy.detailTitle}
                            onClick={() => {
                              setSelectedUser(user);
                              setDetailOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {user.enabled ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-red-500 hover:text-red-600"
                              aria-label={copy.deactivate}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    copy.disableConfirm.replace(
                                      "{name}",
                                      user.fullName,
                                    ),
                                  )
                                ) {
                                  deactivateMutation.mutate(user.id);
                                }
                              }}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-green-600 hover:text-green-700"
                              aria-label={copy.activate}
                              onClick={() => activateMutation.mutate(user.id)}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <p className="text-sm text-gray-500">
                {copy.page
                  .replace("{current}", String(page + 1))
                  .replace("{total}", String(totalPages))}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {copy.prev}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages - 1, value + 1))
                  }
                >
                  {copy.next}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{copy.detailTitle}</DialogTitle>
          </DialogHeader>

          {selectedUser ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-semibold text-white">
                  {selectedUser.fullName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedUser.fullName}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedUser.roles.map((role) => (
                      <Badge
                        key={role}
                        className={cn(
                          "font-medium",
                          ROLE_STYLES[role] || "bg-gray-100 text-gray-700",
                        )}
                      >
                        {copy.roleLabels[
                          role as keyof typeof copy.roleLabels
                        ] || role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{selectedUser.email}</span>
                </div>
                {selectedUser.phoneNumber ? (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedUser.phoneNumber}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>
                    {new Date(selectedUser.createdAt).toLocaleDateString(
                      locale === "vi" ? "vi-VN" : "en-US",
                    )}
                  </span>
                </div>
                <Badge
                  className={
                    selectedUser.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }
                >
                  {selectedUser.enabled
                    ? copy.activeStatus
                    : copy.inactiveStatus}
                </Badge>
              </div>

              <div className="flex gap-3 border-t pt-4">
                {selectedUser.enabled ? (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      deactivateMutation.mutate(selectedUser.id);
                      setDetailOpen(false);
                    }}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    {copy.deactivate}
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      activateMutation.mutate(selectedUser.id);
                      setDetailOpen(false);
                    }}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {copy.activate}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
