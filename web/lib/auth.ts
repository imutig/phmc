import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Discord({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: {
                params: {
                    // guilds.members.read permet de récupérer les rôles du membre
                    scope: "identify email guilds guilds.members.read",
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account && profile) {
                const discordProfile = profile as { id?: string; username?: string; avatar?: string }
                token.discord_id = discordProfile.id
                token.discord_username = discordProfile.username
                token.discord_avatar = discordProfile.avatar
                token.accessToken = account.access_token
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.discord_id = token.discord_id as string
                session.user.discord_username = token.discord_username as string
                session.user.discord_avatar = token.discord_avatar as string
            }
            // Stocker l'access token dans la session
            session.accessToken = token.accessToken as string
            return session
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
})
