import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
    interface Session extends DefaultSession {
        user: {
            discord_id: string
            discord_username: string
            discord_avatar: string
        } & DefaultSession["user"]
        accessToken?: string
    }

    interface User extends DefaultUser {
        discord_id?: string
        discord_username?: string
        discord_avatar?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        discord_id?: string
        discord_username?: string
        discord_avatar?: string
        accessToken?: string
    }
}
