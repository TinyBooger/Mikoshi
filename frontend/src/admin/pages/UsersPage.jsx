import React, { useEffect, useState } from "react";
import Table from "../components/Table";

export default function UsersPage() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(res => res.json())
      .then(setUsers);
  }, []);

  return (
    <div>
      <h2>Users</h2>
      <Table columns={["id", "email", "name", "is_admin", "status"]} data={users} />
    </div>
  );
}
