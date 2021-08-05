export default async function ({ addon, global, console, safeMsg }) {

//Creates the embeds themselves from embed links.

//Constants
//Regexes
const scratchProjectRegExp = /^scratch.mit.edu\/projects\/\d+(?:$|\/$)|embed(?:\/?)$/;
const youTubeRegExp = /^(?:www\.)?youtube.com\/(?:watch\/?\?v=[0-9A-Za-z-_]+|embed\/[0-9A-Za-z-_]+)/;
const youTubeDiscussRegExp = /^scratch.mit.edu\/discuss\/youtube\/[0-9A-Za-z-_]+/;
const audioRegExp = /(?:\.ogg|\.mp3)|(?:\.wav)$/;
const videoRegExp = /\.mp4|\.webm$/;

//Loop
while (true) {
	//Get all embed urls
	var embedLink = await addon.tab.waitForElement('.postmsg a[href="http://ex-embed"]+a, .postsignature a[href="http://ex-embed"]+a', {
		markAsSeen: true,
	});
	var url = new URL(embedLink.href); //URL of embed
	var embedElement; //Embed element
	var embedded = false; //If the embed creation is successful
	
	//Embed types
	//Scratch project
	if (addon.settings.get("project")) {
		if (scratchProjectRegExp.test(url.hostname + url.pathname)) {
			embedElement = document.createElement("iframe");
			embedElement.title = safeMsg("scratch-title");
			embedElement.src = "https://scratch.mit.edu/projects/" + url.pathname.match(/\d+/g)[0] + "/embed/";
			embedElement.width = 499;
			embedElement.height = 416;
			
			embedded = true;
		}
	}
	//Youtube video
	if (addon.settings.get("youtube")) {
		if (youTubeRegExp.test(url.hostname + url.pathname + url.search) || youTubeDiscussRegExp.test(url.hostname + url.pathname)) {
			embedElement = document.createElement("iframe");
			embedElement.title = safeMsg("youtube-title");
			embedElement.src = "https://youtube.com/embed/" + (url.pathname + url.search).match(/(?:(?:embed\/|tch\?v=)|utube\/)[0-9A-Za-z-_]+/g)[0].substring(6) + "/?showinfo=0&rel=0";
			embedElement.width = 560;
			embedElement.height = 315;
			
			embedded = true;
		}
	}
	//Audio file (ogg, mp3, wav)
	if (addon.settings.get("audio")) {
		if (audioRegExp.test(url.pathname)) {
			embedElement = document.createElement("audio");
			embedElement.title = safeMsg("audio-title");
			embedElement.setAttribute("controls", "");
			embedElement.style.width = "calc(100% - 4px)";
			//<source> element
			var sourceElement = document.createElement("source");
			sourceElement.src = url.href;
			embedElement.appendChild(sourceElement);
			
			embedded = true;
		}
	}
	//Video file (mp4, webm)
	if (addon.settings.get("video")) {
		if (videoRegExp.test(url.pathname)) {
			embedElement = document.createElement("video");
			embedElement.title = safeMsg("video-title");
			embedElement.setAttribute("controls", "");
			embedElement.style.width = "calc(100% - 4px)";
			//<source> element
			var sourceElement = document.createElement("source");
			sourceElement.src = url.href;
			embedElement.appendChild(sourceElement);
			
			embedded = true;
		}
	}
	if (embedded) { //If the embedding is successful
		//Insert the embed
		embedElement.style.border = "solid 2px #e0e0e0";
		embedElement.style.display = "block";
		embedLink.parentNode.insertBefore(embedElement, embedLink);
		embedLink.remove();
	}
}

}