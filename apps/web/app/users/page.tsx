interface User {
  id: number
  name: string
  email: string
  role: string
}

async function getUsers(): Promise<User[]> {
  const res = await fetch("http://localhost:8000/users", {
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch users: ${res.status}`)
  }

  return res.json() as Promise<User[]>
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fetched from NestJS API at{" "}
            <code className="font-mono text-xs">http://localhost:8000/users</code>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{user.email}</p>
              </div>
              <span className="bg-muted rounded px-2 py-1 font-mono text-xs">
                {user.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
