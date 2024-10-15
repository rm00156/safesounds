function submit(e) {
  const progressContainer = document.getElementById("progressContainer");
  progressContainer.ariaValueNow = `0`;

  const progressBar = document.getElementById("progress");
  progressBar.style = `width: 0%`;
  progressBar.innerHTML = `0%`;
  const errorSection = document.getElementById("errorSection");
  errorSection.style = "display: none";
  const form = document.getElementById("form");
  e.preventDefault();
  e.stopPropagation();
  if (form.checkValidity()) {
    const button = document.getElementById("button");
    button.classList.remove("btn-primary");
    button.classList.add("btn-success");

    button.innerHTML = "";

    const spinnerSpan = document.createElement("span");
    spinnerSpan.classList.add("spinner-border");
    spinnerSpan.classList.add("spinner-border-sm");
    spinnerSpan.ariaHidden = true;

    const spinnerStatus = document.createElement("span");
    spinnerStatus.role = "status";
    spinnerStatus.append(" Uploading...");

    button.appendChild(spinnerSpan);
    button.appendChild(spinnerStatus);
    button.disabled = true;

    const inputFileElement = $("#inputFile");
    inputFileElement.prop("disabled", true);

    const inputFile = inputFileElement[0];
    console.log(inputFile);
    // Check if a file was selected
    if (inputFile.files.length === 0) {
      alert("Please select a file to upload.");
      return;
    }

    // Create a FormData object

    var formData = new FormData();
    formData.append("file", inputFile.files[0]);

    var request = new XMLHttpRequest();
    request.responseType = "json";

    request.addEventListener("load", function (response) {
      const uploadResponse = response.currentTarget.response;

      const jobId = uploadResponse.id;
      $("#processingTitle").text(`Processing - ${uploadResponse.filename}`);
      form.style = "display:none";

      const processingSection = document.getElementById("processingSection");
      processingSection.style = "display: block";
      updateJob(jobId);
    });

    request.open("post", "/upload");
    request.send(formData);
  }

  form.classList.add("was-validated");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateJob(jobId) {
  $.ajax({
    type: "get",
    url: `/upload/job/id/${jobId}`,
    success: async function (result) {
      const {
        progress,
        date,
        fileNameWithOutExtension,
        fileExtension,
        reason,
        state,
      } = result;

      console.log(state)
      if (state === "failed") {
        const processingSection = document.getElementById("processingSection");
        processingSection.style = "display: none";

        const form = document.getElementById("form");
        form.style = "display: block";

        const errorSection = document.getElementById("errorSection");
        errorSection.style = "display: block";

        $("#errorMessage").text(reason);

        const button = document.getElementById("button");
        button.classList.remove("btn-success");
        button.classList.add("btn-primary");

        button.innerHTML = "Clean";

        button.disabled = false;

        const inputFileElement = $("#inputFile");
        inputFileElement.prop("disabled", false);
        return;
      }
      const progressContainer = document.getElementById("progressContainer");
      progressContainer.ariaValueNow = `${progress}`;

      const progressBar = document.getElementById("progress");
      progressBar.style = `width: ${progress}%`;
      progressBar.innerHTML = `${progress}%`;

      if (progress === 100) {
        const processingSection = document.getElementById("processingSection");
        processingSection.style = "display: none";

        const downloadSection = document.getElementById("downloadSection");
        downloadSection.style = "display: block";

        const download = document.getElementById("download");
        download.href = `/output/${date}/${fileNameWithOutExtension}/final_output${
          fileExtension === ".mp4" ? ".mp4" : ".wav"
        }`;
      } else {
        await wait(1000);
        updateJob(jobId);
      }
    },
  });
}

$(document).ready(() => {
  // setInterval(updateJobs, 1000);
  $("#form").on("submit", submit);
});
