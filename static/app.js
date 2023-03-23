var dictionary = new Typo("en_US", false, false, { dictionaryPath: "typo/dictionaries" });
const Controller = {
  pageSize: () => 5,
  switchSearch: (ch, dic) => {
    document.getElementById("query").value = document.getElementById("query").value.replace(ch, dic);
    const links = document.getElementsByClassName(ch);
    while (links.length > 0) {
      links[0].remove();
    }
    document.getElementById("suggestions").innerHTML = "";
    document.getElementById("suggestionsGroup").classList.add("hidden");
  },
  enableSearch: (e) => {
    const query = document.getElementById("query");
    if (query.value === "") {
      document.getElementById("searchButton").disabled = true;
      document.getElementById("suggestions").innerHTML = "";
      document.getElementById("suggestionsGroup").classList.add("hidden");
    }else if (query.value.length >= 4){
      setTimeout(() =>{
        const check = query.value;
        let links = "";
        let suggestions = [];
        check.split(" ").forEach((ch, i) => {
          if (dictionary.check(ch)){
            return;
          }      
          const fromDict = dictionary.suggest(ch);
          suggestions = suggestions.concat(fromDict.map(dic => ({ch, dic})));
        });

        suggestions.forEach((s) => {
          links += `<a class="${s.ch}" style="cursor:pointer;" onclick="Controller.switchSearch('${s.ch}', '${s.dic}')">${s.dic}</a> `
        });
        document.getElementById("suggestions").innerHTML = links;
        if (links !== "") {
          suggestions = []
          document.getElementById("suggestionsGroup").classList.remove("hidden");
        }
      }, 1000);
    } else {
      document.getElementById("suggestions").innerHTML = "";
      document.getElementById("searchButton").disabled = false;
    }
  },

  search: (ev) => {
    ev.preventDefault();
    const pager = document.getElementById("pagerRow");
    pager.classList.add("hidden");
    document.getElementById("results").innerHTML = "";
    const spinner = document.getElementById("spinnerRow");
    spinner.classList.remove("hidden");
    const form = document.getElementById("form");
    const data = Object.fromEntries(new FormData(form));
    const response = fetch(`/search?q=${data.query}&t=${data.type}`).then((response) => {
      response.json().then((result) => {
        localStorage.setItem("results", 
          JSON.stringify(
            Object.entries(result).map(([index, text]) => 
                ({ index: Number(index), text }))));
        Controller.loadPage(0, data.query);
      });
    });
  },

  getfullParagraph: (index, idx) => {
    const overlay = 500;
    const response = fetch(`/paragraph?index=${index}&pan=${overlay}`).then((response) => {
      response.text().then((paragraph) => {
        const data = Object.fromEntries(new FormData(form));
        document.getElementById("modalControl").click();
        document.getElementById("searchNumber").innerText = `${idx}. ${data.query}`;
        document.getElementById("paragraph").innerText = paragraph;
      });
    });
  },

  quoteElement: (result, idx, query) => {
    const search = query.split(" ");
    const regex = new RegExp(search[0], "gi");
    const title = `${idx}. ${query}`;
    const found = result.text.substring(140, 140+query.length+10).match(regex)[0];
    const link = result.text
                  .substring(140, 140+query.length+10)
                  .replace(regex,`<span title="Click to show full paragraph." style="cursor:pointer;" onclick="Controller.getfullParagraph('${result.index}','${idx}')"><strong>${found}</strong></span>`);

    const text = result.text.substring(0,140) + link + result.text.substring(140+query.length+10);
    

    return `<input type="checkbox" id="collapse-section${idx}" aria-hidden="true" checked>
            <label for="collapse-section${idx}" aria-hidden="true">${title}</label>
            <div>
              <p class="doc"><em>${text}</em></p>
            </div>`;
  },

  loadPage: (pageNumber, query) => {
    const results = JSON.parse(localStorage.getItem("results"));
    if (results.length > 0) {
      const noResults = document.getElementById("noResults");
      noResults.classList.add("hidden");
      const resultSection = document.getElementById("results");
      resultSection.classList.remove("hidden");
      const endSlice = Controller.pageSize() + (pageNumber * Controller.pageSize());
      const page = results.slice(pageNumber * Controller.pageSize(), endSlice);
      let quotes = "";
      page.forEach((result, idx) => {
        quotes += Controller.quoteElement(result, idx + 1 + (pageNumber * Controller.pageSize()), query);
      });
      resultSection.innerHTML = quotes;
      if (pageNumber === 0) {
        document.getElementById("loadLessBtn").classList.add("hidden");
        document.getElementById("loadMoreBtn").classList.remove("hidden");
      }
      else if (results.length <= endSlice) {
        document.getElementById("loadLessBtn").classList.remove("hidden");
        document.getElementById("loadMoreBtn").classList.add("hidden");
      }
      else{
        document.getElementById("loadLessBtn").classList.remove("hidden");
        document.getElementById("loadMoreBtn").classList.remove("hidden");
      }
      document.getElementById("pgNumber").innerHTML = `${pageNumber + 1} / ${Math.ceil(results.length / Controller.pageSize())}`;
      const button = document.getElementById("pagerRow");
      button.classList.remove("hidden");
    }
    else {
      const pager = document.getElementById("pagerRow");
      pager.classList.add("hidden");
      const noResults = document.getElementById("noResults");
      noResults.classList.remove("hidden");
    }
    const spinner = document.getElementById("spinnerRow");
    spinner.classList.add("hidden");
  },

  changePage: (increment) => {
    const spinner = document.getElementById("spinnerRow");
    spinner.classList.remove("hidden");
    const pageNumber = parseInt(document.getElementById("pgNumber").innerText.split('/')[0]) -1 + increment;
    const data = Object.fromEntries(new FormData(form));
    Controller.loadPage(pageNumber, data.query);
  },
};

const form = document.getElementById("form");
form.addEventListener("submit", Controller.search);
