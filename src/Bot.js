const Discord = require('discord.js');
const Sqlite = require('better-sqlite3');

class Bot extends Discord.Client {
    constructor() {
        super();
        this.db = Sqlite('database.db');
        this.db.prepare("CREATE TABLE IF NOT EXISTS leaderboard (guildId TEXT NOT NULL, userId TEXT NOT NULL, rep INTEGER, wins INTEGER, competition INTEGER, UNIQUE(guildId, userId))").run();
        this.db.prepare("CREATE TABLE IF NOT EXISTS admins (guildId, roleId)").run();
        this.cooldowns = new Discord.Collection();
        this.leaderboard = new Discord.Collection();
        this.admins = new Discord.Collection();

        let stmt = this.db.prepare('SELECT * FROM leaderboard');
        for (const user of stmt.iterate()) {
            this.leaderboard.set(`${user.guildId}-${user.userId}`, user);
        }

        stmt = this.db.prepare('SELECT * FROM admins');
        for (const admin of stmt.iterate()) {
            if (this.admins.get(admin.guildId))
                this.admins.set(admin.guildId, [...this.admins.get(admin.guildId),admin]);
            else
                this.admins.set(admin.guildId, [admin]);
        }
    }

    giveRep(points, gifter, giftee) {
        return new Promise(async (resolve, reject) => {
            let user = await this.findUser(giftee, gifter.guild);
            if (!user)
                reject("invalid user");
            else if (user.id == gifter.id)
                reject("invalid user");
            else {
                let perms = gifter.roles.some(el => {
                    return this.admins.get(gifter.guild.id) ? this.admins.get(gifter.guild.id).has(el.id) : false;
                });
                if ((points > 1 || points < 0) && (!gifter.hasPermission("ADMINISTRATOR") && !perms))
                    reject("not enough perms");
                else {
                    let cooldown = this.cooldowns.get(gifter.guild.id+'-'+gifter.user.id) || 0;
                    if (Date.now() - cooldown < 3e+5 && !perms)
                        reject("cooldown");
                    else {
                        try {
                            this.db.prepare(`INSERT INTO leaderboard(guildId, userId, rep, wins, competition) VALUES(?,?,?,?,?)`).run(gifter.guild.id, user.id, points, 0, 0);
                        } catch(e) {
                            this.db.prepare("UPDATE leaderboard SET rep = rep + ? WHERE guildId = ? AND userId = ?").run(points, gifter.guild.id, user.id);
                        }
                        this.leaderboard.set(gifter.guild.id, this.db.prepare("SELECT * FROM leaderboard WHERE guildId = ? AND userId = ?").get(gifter.guild.id, user.id));
                        this.cooldowns.set(gifter.guild.id+'-'+gifter.user.id, Date.now());
                        resolve(user);
                    }
                }
            }
        });
    }

    giveAdmin(member, role) {
        return new Promise(async (resolve, reject) => {
            let r = member.guild.roles.get(role.replace(/<@&(\d+)>/,"$1"));
            if (!r)
                reject();
            else {
                let perms = member.roles.some(el => {
                    return this.admins.get(member.guild.id) ? this.admins.get(member.guild.id).has(el.id) : false;
                });

                if (!perms && !member.hasPermission("ADMINISTRATOR"))
                    reject("perms");
                else {
                    this.db.prepare("INSERT INTO admins(guildId, roleId) VALUES(?,?)").run(member.guild.id, r.id);
                    if (this.admins.get(member.guild.id))
                        this.admins.set(member.guild.id, [...this.admins.get(member.guild.id),r.id]);
                    else
                        this.admins.set(member.guild.id, [r.id]);
                    resolve(r);
                }       
            }
        });
    }

    givePoint(member, u) {
        return new Promise(async (resolve, reject) => {
            let user = await this.findUser(u, member.guild);
            if (!user)
                reject("invalid user");
            else {
                let perms = member.roles.some(el => {
                    return this.admins.get(member.guild.id) ? this.admins.get(member.guild.id).has(el.id) : false;
                });

                if (!perms && !member.hasPermission("ADMINISTRATOR"))
                    reject("perms");
                else {
                    try {
                        this.db.prepare(`INSERT INTO leaderboard(guildId, userId, rep, wins, competition) VALUES(?,?,?,?,1)`).run(member.guild.id, user.id,0, 0);
                    } catch(e) {
                        this.db.prepare("UPDATE leaderboard SET competition = competition + 1 WHERE guildId = ? AND userId = ?").run(member.guild.id, user.id);
                    }
                    this.leaderboard.set(member.guild.id, this.db.prepare("SELECT * FROM leaderboard WHERE guildId = ? AND userId = ?").get(member.guild.id, user.id));
                    resolve(user);
                }       
            }
        });
    }

    giveWin(member, u) {
        return new Promise(async (resolve, reject) => {
            let user = await this.findUser(u, member.guild);
            if (!user)
                reject("invalid user");
            else {
                let perms = member.roles.some(el => {
                    return this.admins.get(member.guild.id) ? this.admins.get(member.guild.id).has(el.id) : false;
                });

                if (!perms && !member.hasPermission("ADMINISTRATOR"))
                    reject("perms");
                else {
                    try {
                        this.db.prepare(`INSERT INTO leaderboard(guildId, userId, rep, wins, competition) VALUES(?,?,?,1,?)`).run(member.guild.id, user.id,0, 0);
                    } catch(e) {
                        this.db.prepare("UPDATE leaderboard SET wins = wins + 1 WHERE guildId = ? AND userId = ?").run(member.guild.id, user.id);
                    }
                    this.leaderboard.set(member.guild.id, this.db.prepare("SELECT * FROM leaderboard WHERE guildId = ? AND userId = ?").get(member.guild.id, user.id));
                    resolve(user);
                }       
            }
        });
    }

    async getBoard(guild) {
        let leaderboard = this.db.prepare("SELECT * FROM leaderboard WHERE guildId = ? ORDER BY wins+competition DESC LIMIT 10").all(guild.id);
        let message = "😐 I have no recordings for this server.";
        if (!leaderboard.length)
            return message;
        else {
            let i = 0;
            message = "";
            for (const u of leaderboard) {
                message += `[${++i}]\t> #${(await this.fetchUser(u.userId)).tag}\n\t\t\tWins: ${u.wins} | Participations: ${u.competition} | Reputations: ${u.rep}\n`;
            }
            message += `------------------------------------------------`;
            message = `:cityscape: | Guild Score Leaderboards for ${guild.name}\n\n\`\`\`cs\n📋 Rank | Name\n\n${message}\n\`\`\``;
            return message;
        }
            

    }

    async findUser(input, guild) {
        return new Promise(async (resolve, reject) => {
            let user = await this.fetchUser(input, true).catch(err => console.log(`${input} cannot be fetched. Continuing rest of the function now`)); // Try and fetch a user by id and cache it
            if (!user && guild) {
                try{
                    user = this.guilds.get(guild.id).members.find(m => m.user.tag.toLowerCase().startsWith(input.toLowerCase())).user; // Find the first user that starts with input
                } catch (er) {
                    return resolve(undefined);
                }
            } else if (!user) return reject(new Error("Expected value for \"guild\""));
            return resolve(user);
        }); 
    }


}

module.exports = Bot;