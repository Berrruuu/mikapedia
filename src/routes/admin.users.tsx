import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type ChangeEvent } from "react";
import { Users, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usersApi, type UserSummary } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("trader");
  const [inviteStatus, setInviteStatus] = useState("active");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState("trader");
  const [editStatus, setEditStatus] = useState("active");
  const [editError, setEditError] = useState<string | null>(null);

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInvitePassword("");
    setInviteRole("trader");
    setInviteStatus("active");
    setInviteError(null);
  };

  const resetEditForm = () => {
    setSelectedUser(null);
    setEditEmail("");
    setEditFirstName("");
    setEditLastName("");
    setEditRole("trader");
    setEditStatus("active");
    setEditError(null);
  };

  const openEditDialog = (user: UserSummary) => {
    const nameParts = (user.name || "").split(" ");
    setSelectedUser(user);
    setEditEmail(user.email);
    setEditFirstName(nameParts[0] ?? "");
    setEditLastName(nameParts.slice(1).join(" ") ?? "");
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditOpen(true);
  };

  const handleInviteSubmit = async () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName || invitePassword.length < 8) {
      setInviteError("Please fill all fields and use a password with at least 8 characters.");
      return;
    }

    setInviteLoading(true);
    setInviteError(null);

    try {
      const created = await usersApi.create({
        email: inviteEmail,
        password: invitePassword,
        first_name: inviteFirstName,
        last_name: inviteLastName,
        role: inviteRole,
        status: inviteStatus,
      });
      setUsers((prev) => [created, ...prev]);
      toast.success(`${created.name} berhasil ditambahkan sebagai ${inviteRole}.`);
      setInviteOpen(false);
      resetInviteForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat trader.";
      setInviteError(message);
      toast.error(message);
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await usersApi.list({ role: "trader", page_size: 200 });
        setUsers(data);
      } catch (error) {
        console.error("Failed to load users", error);
        toast.error(error instanceof Error ? error.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    void fetchUsers();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        description="Role-based access control for supervisors and traders."
        actions={
          <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Invite user
          </Button>
        }
      />
      <Card className="p-0 overflow-hidden">
        <div className="p-6">
          <div className="text-sm text-muted-foreground">{loading ? "Loading users..." : `${users.length} traders loaded.`}</div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Joined</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Loading users…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No traders found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                            {((u.name || "")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={u.role === "Administrator" || u.role === "Supervisor" ? "bg-primary/10 text-primary border-primary/20 gap-1" : ""}>
                        {(u.role === "Administrator" || u.role === "Supervisor") && <Shield className="h-3 w-3" />}
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={u.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : "—"}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(u)}>Edit</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={(open) => {
        setInviteOpen(open);
        if (!open) resetInviteForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Trader</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>First Name</Label>
              <Input
                value={inviteFirstName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setInviteFirstName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Last Name</Label>
              <Input
                value={inviteLastName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setInviteLastName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={invitePassword}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setInvitePassword(event.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trader">Trader</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={inviteStatus} onValueChange={setInviteStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {inviteError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {inviteError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Batal</Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={handleInviteSubmit}
              disabled={inviteLoading}
            >
              {inviteLoading ? "Mengundang…" : "Invite trader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) resetEditForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Trader</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEditEmail(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>First Name</Label>
              <Input
                value={editFirstName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEditFirstName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Last Name</Label>
              <Input
                value={editLastName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEditLastName(event.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trader">Trader</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {editError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={async () => {
                if (!selectedUser) return;
                if (!editEmail || !editFirstName || !editLastName) {
                  setEditError("Please fill all fields.");
                  return;
                }
                setEditLoading(true);
                setEditError(null);
                try {
                  const updated = await usersApi.update(selectedUser.id, {
                    email: editEmail,
                    first_name: editFirstName,
                    last_name: editLastName,
                    role: editRole,
                    status: editStatus,
                  });
                  setUsers((prev) => prev.map((user) => user.id === updated.id ? updated : user));
                  toast.success(`${updated.name} berhasil diperbarui.`);
                  setEditOpen(false);
                  resetEditForm();
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Gagal memperbarui trader.";
                  setEditError(message);
                  toast.error(message);
                } finally {
                  setEditLoading(false);
                }
              }}
              disabled={editLoading}
            >
              {editLoading ? "Menyimpan…" : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
