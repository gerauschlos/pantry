const Bot = require('./src/Bot.js');
const config = require('./config.json');
const { RichEmbed } = require('discord.js')
const client = new Bot();
const { readdirSync } = require('fs');
let presences = ["📚 Writing Pantry","😍 Falling in love with fiction", "📗 Drowned in poetry"];
let avatars = readdirSync('./images');

client.login(config.token);

client.on("ready", () => {
    client.setInterval(() => {
        client.user.setActivity(presences[Math.floor(Math.random()*presences.length)]);
    },60000);
    
    client.setInterval(() => {
        client.user.setAvatar(`./images/${avatars[Math.floor(Math.random()*avatars.length)]}`);
    },3600000);

    client.user.setActivity(presences[Math.floor(Math.random()*presences.length)]);
    client.user.setAvatar(`./images/${avatars[Math.floor(Math.random()*avatars.length)]}`);

    console.log(client.user.username+" is now online.");
    console.log(`ID: ${client.user.id}`);
});

client.on("message", async msg => {
    if (!msg.guild || msg.author.bot || !msg.content.startsWith(">"))
        return;
    
    let msgArray = msg.content.slice(1).split(" ");
    switch (msgArray[0]) {
        case "r":
        case "rep":
            let points = msgArray.length == 4 ? Math.floor(Number(msgArray[1])) : 1;
            await client.giveRep(points, msg.member, msg.mentions.members.first() || msgArray.slice(points-1)[1])
                .then(user => {
                    msg.channel.send(`I gave a reputation point to <@${user.id}>.`);
                })
                .catch(err => {
                    if (err == "invalid user")
                        msg.channel.send("Could not find that user sorry.");
                    else if (err == "not enough perms")
                        msg.channel.send("You do not have permission to give more than one or less than 0 reputation points");
                    else
                        msg.channel.send("You are still on cooldown please wait atleast a day before giving a reputation point again.");
                });
            break;
        case "priv":
        case "admin":
            await client.giveAdmin(msg.member, msg.mentions.roles.first())
                .then((r) => {
                    msg.channel.send(`People with the ${r.name} role now have permission to give more than 1 reputation at a time and other perks.`);
                })
                .catch(err => {
                    if (err == "perms")
                        msg.channel.send("You do not have permission to give roles admin privs.");
                    else   
                        msg.channel.send("Could not find that role.");
                });
            break;
        case "point":
            await client.givePoint(msg.member, msg.mentions.members.first() || msgArray[1])
                .then(user => {
                    msg.channel.send(`Gave a point to <@${user.id}> for participation.`);
                })
                .catch(err => {
                    if (err == "perms")
                        msg.channel.send("You do not have permission to points to users.");
                    else   
                        msg.channel.send("Could not find that ruser.");
                });
            break;
        case "giveW":
        case "give-win":
            await client.giveWin(msg.member, msg.mentions.members.first() || msgArray[1])
                .then(user => {
                    msg.channel.send(`Gave a win to <@${user.id}>`);
                })
                .catch(err => {
                    console.log(err);
                })
            break;
        case "lb":
        case "leaderboard":
            await msg.channel.send(await client.getBoard(msg.guild));
            break;
        case "me":
        case "rank":
            await msg.channel.send(await client.getRank(msg.mentions.members.first() || msg.member));
            break;
        default:
            let channel = await msg.author.createDM();
            let embed = new RichEmbed()
                .setAuthor(client.user.username, client.user.avatarURL)
                .setDescription("Looks like you need some help, so here you go!")
                .addField("Example", ">give-win [username #]\n>point [username #]\n>admin [role #]\n>rep [point #] [username #]\t\n>lb",true)
                .addField("Alias","giveW/give-win\nadmin/priv\nrep/r\nlb/leaderboard",true)
                .setFooter(client.user.username+" | "+msg.author.username, client.user.avatarURL)
                .setColor(0x4dcc82)
                .setTimestamp();
            channel.send(embed);

    }
});