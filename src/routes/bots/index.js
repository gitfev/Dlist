const { isURL } = require('@utils/isSomething');
const { Router } = require("express");

const resubmit = require("@routes/bots/resubmit");
const search = require("@routes/bots/search");
const edit = require("@routes/bots/edit");
const like = require("@routes/bots/like");
const Bots = require("@models/bots");

const { server: {id, admin_user_ids, role_ids: {bot_verifier}} } = require("@root/config.json");

const route = Router();

route.use("/resubmit", resubmit);
route.use("/search", search);
route.use("/like", like);
route.use("/edit", edit);

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

route.get('/:id', async (req, res) => {
    let bot = await Bots.findOne({botid: req.params.id}, { _id: false, auth: false });
    
    if (!bot) return res.render("404", {req});

    let error = false;
    const botUser = await req.app.get('client').guilds.cache.get(globalThis.config.server.id).members.fetch(bot.botid).catch(() => {
        error = true
    });

    if(error) return res.render("404", {req})
    // Update user properties
    if (bot.logo !== `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.user.avatar}.png`) 
        await Bots.updateOne({ botid: req.params.id }, {$set: {logo: `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.user.avatar}.png` }});

    if (bot.username !== botUser.username)
        await Bots.updateOne({ botid: req.params.id }, {$set: {username: botUser.username}});
    
    if (bot.state === "deleted") return res.render("404", {req})

    let owners = [bot.owners.primary].concat(bot.owners.additional);

    // If bot is unverified, check that the user is either a bot owner, admin or bot verifier
    if (bot.state == "unverified" && (!req.user || !owners.includes(req.user.id) && !admin_user_ids.includes(req.user.id))) {
        if (!req.user) return res.render("403", {req})
        let member = await req.app.get('client').guilds.cache.get(id).members.fetch(req.user.id)
        if (!member || !member.roles.cache.has(bot_verifier)) return res.render("403", {req})
    }

    try {
        owners = (await req.app.get('client').guilds.cache.get(id).members.fetch({user: owners})).map(x => { return x.user });
    } catch (e) {
        owners = [{tag: "Unknown User"}]
    }
    let b = "#8c8c8c";
    let c = botUser.presence?.status
    switch (c) {
        case "online":
            b = "#32ff00"
            break;
        case "idle":
            b = "#ffaa00";
            break;
        case "dnd":
            b = "#ff0000";
            break;
        default:
            b = req.cookies["theme"] == "light" ? "F7F4EA" : "404E5C";
            break;
    }
    var desc = ``;
    let possibleURL = bot.long.replaceAll("\n", "").replaceAll(" ", "");
    let isUrl = isURL(possibleURL)
    if (isUrl) {
        desc = `<iframe src="${possibleURL}" width="600" height="400" id="url-embed"><object data="${possibleURL}" width="600" height="400" style="width: 100%; height: 100vh;"><embed src="${possibleURL}" width="600" height="400" style="width: 100%; height: 100vh;"> </embed>${possibleURL}</object></iframe>`
    } else if (bot.long) desc = bot.long;
    else desc = bot.description;

    let servers;
    if (bot.servers[bot.servers.length - 1])
        servers = bot.servers[bot.servers.length - 1].count;
    else servers = null;

    let activity = ``;
    if (botUser.presence?.activities?.length > 0) {
        //console.log(`${Object.keys(botUser.presence.activities)} | ${Object.values(botUser.presence.activities)}`)
        /*activity += `${botUser.presence?.activities[0].type.toLowerCase().capitalize()} ${botUser.presence?.activities[0].name}`*/
        activity += botUser.presence.activities[0];
    }

    //console.log(botUser.user.flags.toArray());
    let discord_verified = botUser.user.flags.toArray().includes("VerifiedBot"); //VerifiedBot,BotHTTPInteractions
    
    res.render("bots", {
        bot,
        botUser,
        servers,
        owners,
        desc,
        isUrl,
        activity,
        discord_verified,
        bcolour: b,
        req
    });
})

module.exports = route;
