$(document).ready(function () {
  const oktaSignIn = new OktaSignIn({
    issuer: "https://dev-28211772.okta.com/oauth2/default",
    redirectUri: 'http://localhost:3000/',
    clientId: "0oa4hy1gjyAb4TrBm5d7",
    useInteractionCodeFlow: true
  });

  oktaSignIn.authClient.token.getUserInfo().then(async function (user) {
    var jwt = await oktaSignIn.authClient.tokenManager.get("accessToken");

    await get_rounds_status(jwt.accessToken, jwt.claims.Groups[0])
  }, async function (error) {
    document.getElementById("rosters_table").style.display = 'none';
    oktaSignIn.showSignInToGetTokens({
      el: '#okta-login-container'
    })
      .then(async function (tokens) {
        oktaSignIn.authClient.tokenManager.setTokens(tokens);
        oktaSignIn.remove();

        var jwt = await oktaSignIn.authClient.tokenManager.get("accessToken");

        await get_rounds_status(jwt.accessToken, jwt.claims.Groups[0]);
      }).catch(function (err) {
        console.error(err);
      });
  });

  $("#submit").on('show.bs.modal', function (event) {
    var modal = $(this);

    var button = $(event.relatedTarget);
    var round = button.data('round');
    var resub = button.data('resubmit');

    var submitWord;
    submitWord = resub ? "Resubmit" : "Submit"

    modal.find(".modal-title").text(`${submitWord} Roster(s) For Round ${round}`)
    modal.find("#submitRosters").attr("data-round", round);
  });
  $("#view").on('show.bs.modal', async function (event) {
    var modal = $(this);

    var button = $(event.relatedTarget);
    var round = button.data('round');
    var resub = button.data('resubmit');

    var submitWord;
    submitWord = resub ? "Resubmit" : "Submit"

    modal.find(".modal-title").text(`Fencers For Round ${round}`)

    var jwt = await oktaSignIn.authClient.tokenManager.get("accessToken");

    await get_fencers_for_round(jwt.accessToken, jwt.claims.Groups[0], round);
  });

  $("#closeRosters").click(() => {
    $("#m_upload").val("");
    $("#w_upload").val("");
  })

  $("#viewX").click(() => {
    clearView()
  })

  $("#closeView").click(() => {
    clearView()
  })

  function clearView() {
    $("#menViewTable tbody tr").remove();
    $("#womenViewTable tbody tr").remove();
  }

  // submits rosters to the api
  $("#submitRosters").click(async function (event) {
    var button = $(this);

    // gets the round the user is submitting for
    var round = button.data('round');

    // gets the roster files
    let menRoster = document.getElementById("m_upload").files[0];
    let womenRoster = document.getElementById("w_upload").files[0];

    // makes sure they at least sumbitted one roster file
    if (!menRoster && !womenRoster) {
      alert("Please attach at least one roster and try again");
      return;
    }

    const formData = new FormData();
    // attach the men's roster, if there is one
    if (menRoster)
      formData.append("men", menRoster);

    // attach the women's roster, if there is one
    if (womenRoster)
      formData.append("women", womenRoster);

    // gets the jwt for this session
    var jwt = await oktaSignIn.authClient.tokenManager.get("accessToken");

    // calls the api    
    fetch(`https://localhost:7291/api/roster?round=${round}`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${jwt.accessToken}`
      },
      body: formData
    })
      .then(response => response.json())
      .then(async (data) => {
        // TODO report any fencers that weren't already in the database
        // refresh the table
        $("#rosters_table tbody tr").remove();
        await get_rounds_status(jwt.accessToken, jwt.claims.Groups[0])

        // close the modal 
        $("#submit").modal("toggle");

        // clear the file input
        $("#m_upload").val("");
        $("#w_upload").val("");

        document.getElementById("alert_large").style.display = null;
        data.newFencers.forEach((f) => {
          $("#alert_large_text").append(`${f.firstName} ${f.lastName}`)
        })
      })
  })

  async function get_fencers_for_round(jwt, school, round) {
    const menResp = await fetch(`https://localhost:7291/api/fencer/${school}/${round}/m`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      }
    });

    const womenResp = await fetch(`https://localhost:7291/api/fencer/${school}/${round}/f`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      }
    });

    var men = await menResp.json();
    var women = await womenResp.json();

    men.forEach((m) => {
      var row = document.getElementById("menViewTableBody").insertRow(-1);

      row.insertCell(0).innerHTML = m.firstName;
      row.insertCell(1).innerHTML = m.lastName;
    });

    women.forEach((m) => {
      var row = document.getElementById("womenViewTableBody").insertRow(-1);

      row.insertCell(0).innerHTML = m.firstName;
      row.insertCell(1).innerHTML = m.lastName;
    });
  }

  // gets the round/roster status
  async function get_rounds_status(jwt, school) {
    // get round submission statuses 
    const response = await fetch(`https://localhost:7291/api/roster/${school}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json"
      }
    });

    var rounds = await response.json();

    document.getElementById("rosters_table").style.display = null;
    document.getElementById("school_name").innerHTML = `Submitting for: ${school}`

    rounds.forEach((r) => {
      // add row to end
      var row = document.getElementById("roster_table_body").insertRow(-1);

      // add columns 
      row.insertCell(0).innerHTML = r.round;
      row.insertCell(1).innerHTML = r.submittedMale ? "Submitted" : "Not Submitted";
      row.insertCell(2).innerHTML = r.submittedFemale ? "Submitted" : "Not Submitted";

      // create buttons
      var submitButton = createSubmitButton(r.round);
      var viewButton = createViewButton(r.round);

      // add buttons
      row.insertCell(3).appendChild(submitButton);
      row.insertCell(4).appendChild(viewButton);

      // male or female is exclusively submitted
      if (r.submittedFemale != r.submittedMale) {
        row.classList.add("table-warning");
        submitButton.innerHTML = "Submit";
        submitButton.setAttribute("data-resubmit", true);
      }
      // neither are submitted
      else if (!r.submittedFemale || !r.submittedFemale) {
        row.classList.add("table-danger");
        submitButton.innerHTML = "Submit";
        submitButton.setAttribute("data-resubmit", false);
        viewButton.disabled = true;
        viewButton.classList.add("btn-secondary");
      }
      // both are submitted
      else {
        row.classList.add("table-success");
        submitButton.innerHTML = "Resubmit";
        submitButton.setAttribute("data-resubmit", true);
      }
    });

    // creates the "View" button that lets users view the roster
    function createViewButton(round) {
      var viewButton = document.createElement("button");
      viewButton.id = `v${round}`;
      viewButton.classList.add("btn-primary");
      viewButton.setAttribute("data-toggle", "modal");
      viewButton.setAttribute("data-target", "#view");
      viewButton.setAttribute("data-round", round);
      viewButton.innerHTML = "View"
      return viewButton;
    }

    // creates the "View" button that lets users view the roster
    function createSubmitButton(round) {
      var submitButton = document.createElement("button");
      submitButton.id = `s${round}`;
      submitButton.classList.add("btn-primary");
      submitButton.setAttribute("data-toggle", "modal")
      submitButton.setAttribute("data-target", "#submit")
      submitButton.setAttribute("data-round", round)
      return submitButton
    }
  }
});

