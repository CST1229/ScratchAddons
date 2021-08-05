export default async function ({ addon, global, console, safeMsg }) {
  //Adds the embed button to the post editor toolbar.

  //Constants
  //Regexes (i tried using global but it just wouldn't work for some reason)
  const scratchProjectRegExp = /^scratch.mit.edu\/projects\/\d+(?:$|\/$)|embed(?:\/?)$/;
  const youTubeRegExp = /^(?:www\.)?youtube.com\/(?:watch\/?\?v=[0-9A-Za-z-_]+|embed\/[0-9A-Za-z-_]+)/;
  const youTubeDiscussRegExp = /^scratch.mit.edu\/discuss\/youtube\/[0-9A-Za-z-_]+/;
  const audioRegExp = /(?:\.ogg|\.mp3)|(?:\.wav)$/;
  const videoRegExp = /\.mp4|\.webm$/;
  //Elements (also simultaneously making sure that the editor exists)
  const textBox = await addon.tab.waitForElement("#id_body, #id_signature"); //Post editor textbox
  const linkButton = await addon.tab.waitForElement(".markItUpButton6"); //Link button (used to insert the button after the link button)
  //Images
  const embedIcon =
    'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAPhJREFUOI1jYKAQMMIY9+/f/0+KRkVFRUa4Affv3/8vKyvLMP9CA1xBokEDw+lEU4b3V54wCOrIMJjOP41iwOPHjxkUFRUZmZAFf/79zfD8y304//2VJwxGZpwM7688wekSFnSBKpuFcLagjgzDuVMQF+ACKF7Yv38/ToXIwNHREe4FDBfAgIWFBQr/xIkTWNVhNcDCwoJhxc1Ohudf7jNI8igyPP9yn6HQYgZWQ5iw6GdgYGCAB+bzL/cZhDhxhwFOL3z4+Y1BSUANp0aCBnD84WGI16ohaABWL5w4cYKh0m4ahhhJLsClAa8Bjo6ORGlCBhRnJooBAIxiVSpSDkOkAAAAAElFTkSuQmCC")'; //Add Embed icon

  //Add the button
  var embedButton = document.createElement("li");
  embedButton.className = "markItUpButton markItUpButton17";
  //The <a> element
  var embedButtonLink = document.createElement("a");
  embedButtonLink.textContent = safeMsg("embed-add-hover");
  embedButtonLink.title = safeMsg("embed-add-hover");
  embedButtonLink.style["background-image"] = embedIcon;
  embedButtonLink.id = "embedButton";
  embedButton.appendChild(embedButtonLink);
  //Insert the button
  linkButton.parentNode.insertBefore(embedButton, linkButton.nextSibling);
  //Dynamic enable and disable
  addon.tab.displayNoneWhileDisabled(embedButton, { display: "inline" });

  //Button function
  const addEmbedFunction = function () {
    var link = prompt(safeMsg("embed-add-prompt"));
    if (link == null) {
      return;
    } //Cancelling

    const invalidURL = function () {
      alert(safeMsg("embed-add-error"));
    }; //If a URL is invalid
    try {
      var url = new URL(link); //Validate the URL
    } catch (error) {
      try {
        var url = new URL("https://" + link); //Since URL() doesn't like URLs without protocols, we have to do this
      } catch (error) {
        invalidURL(); //Okay, the URL is actually invalid
        return;
      }
    }
    if (
      scratchProjectRegExp.test(url.hostname + url.pathname) ||
      youTubeRegExp.test(url.hostname + url.pathname + url.search) ||
      youTubeDiscussRegExp.test(url.hostname + url.pathname) ||
      audioRegExp.test(url.pathname) ||
      videoRegExp.test(url.pathname)
    ) {
      //Test for any of the regexes
      //It's a valid link for embeds
      var insertText = "[url=ex-embed][/url][url=" + url + "]" + safeMsg("embed-placeholder") + "[/url]"; //Prepare the text to add to the textbox
      if (textBox.selectionStart === textBox.value.length && textBox.selectionEnd === textBox.value.length) {
        //Cursor is at the end
        textBox.value += insertText;
      } else {
        //Cursor is somewhere else or is selecting a part of the textbox
        textBox.value =
          textBox.value.substring(0, textBox.selectionStart) +
          insertText +
          textBox.value.substring(textBox.selectionEnd - 1, textBox.value.length);
      }
    } else {
      //Not an embed link
      invalidURL();
      return;
    }
  };
  //Finally, add all this to the embed button
  embedButtonLink.onclick = addEmbedFunction;
}
