package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"index/suffixarray"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/texttheater/golang-levenshtein/levenshtein"
)

func main() {
	searcher := Searcher{}
	err := searcher.Load("completeworks.txt")
	if err != nil {
		log.Fatal(err)
	}

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	http.HandleFunc("/search", handleSearch(searcher))

	http.HandleFunc("/paragraph", handleParagraph(searcher))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fmt.Printf("Listening on port %s...", port)
	err = http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
	if err != nil {
		log.Fatal(err)
	}
}

type Searcher struct {
	CompleteWorks string
	SuffixArray   *suffixarray.Index
}

func handleSearch(searcher Searcher) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		queryValues := r.URL.Query()
		query := queryValues.Get("q")
		searchType := queryValues.Get("t")
		if len(query) < 1 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("missing search query in URL params"))
			return
		}
		results := map[int]string{}
		if searchType == "broad" {
			results = searcher.LevSearch(query)
		} else {
			results = searcher.ExactSearch(query)
		}

		buf := &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		err := enc.Encode(results)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("encoding failure"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(buf.Bytes())
	}
}

func handleParagraph(searcher Searcher) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		index, ok := r.URL.Query()["index"]
		pan, ok := r.URL.Query()["pan"]
		if !ok || len(index[0]) < 1 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("missing search query in URL params"))
			return
		}
		searchIndex, err := strconv.Atoi(index[0])
		panorama, err := strconv.Atoi(pan[0])
		results := searcher.GetParagraph(searchIndex, panorama)

		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("encoding failure"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(results))
	}
}

func (s *Searcher) Load(filename string) error {
	dat, err := ioutil.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("Load: %w", err)
	}
	s.CompleteWorks = string(dat)
	s.SuffixArray = suffixarray.New(dat)
	return nil
}

func (s *Searcher) ExactSearch(query string) map[int]string {
	idxs := s.SuffixArray.Lookup([]byte(query), -1)
	idxs = append(idxs, s.SuffixArray.Lookup([]byte(strings.ToUpper(query)), -1)...)
	idxs = append(idxs, s.SuffixArray.Lookup([]byte(strings.ToLower(query)), -1)...)
	idxs = append(idxs, s.SuffixArray.Lookup([]byte(CapitalizeFirst(query)), -1)...)

	results := make(map[int]string)
	for _, idx := range idxs {
		start := 0
		end := len(s.CompleteWorks)
		if idx-150 > start {
			start = idx - 150
		}
		if idx+150 < end {
			end = idx + 150
		}

		results[idx] = s.CompleteWorks[start:end]
	}

	return results
}

func (s *Searcher) GetParagraph(index int, pan int) string {
	return s.CompleteWorks[index-pan : index+pan]
}

func CapitalizeFirst(sentence string) string {
	words := strings.Fields(sentence)
	words[0] = strings.Title(strings.ToLower(words[0]))
	return strings.Join(words, " ")
}

func (s *Searcher) LevSearch(query string) map[int]string {
	minDistance := len(query) * 3
	matchMap := map[int]string{}

	for i := 0; i <= len(s.CompleteWorks)-len(query); i++ {
		distance := levenshtein.DistanceForStrings([]rune(s.CompleteWorks[i:i+len(query)]), []rune(query), levenshtein.DefaultOptions)

		start := 0
		end := len(s.CompleteWorks)
		if i-150 > start {
			start = i - 150
		}
		if i+150 < end {
			end = i + 150
		}

		if distance < minDistance {
			minDistance = distance
			matchMap = map[int]string{i: s.CompleteWorks[start:end]}
		} else if distance == minDistance {
			matchMap[i-1] = s.CompleteWorks[start:end]
		}
	}
	return matchMap
}
