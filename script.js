const BASE_URL = "https://llm-2-0.vercel.app/api/chat"
const PASSWORD = "" // enter api password here

const HEADERS = {
  "Content-Type": "application/json",
}

async function send(BODY) {
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        request_body: BODY,
        password: PASSWORD,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      const json = JSON.parse(text)
      console.error("API Error:", json)
      return null
    }

    const { message } = await res.json()
    return message
  } catch (error) {
    console.error("Network Error:", error)
    return null
  }
}

async function getAnswer(question, options) {
  const prompt = `Question: ${question}\nOptions:\n${options.map((opt, index) => `${index + 1}. ${opt}`).join("\n")}`
  const BODY = {
    model: "Meta-Llama-3.1-70B-Instruct",
    messages: [
      {
        role: "system",
        content:
          "Be descriptive on how you got your answer. Have your answer be clear though, and have it at the top of the text.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: false,
  }
  return send(BODY)
}

async function extractAnswer(answerText) {
  const BODY = {
    model: "Meta-Llama-3.2-3B-Instruct",
    messages: [
      {
        role: "user",
        content: `Extract the answer from the following text, and only return the answer no other text: ${answerText}`,
      },
    ],
    stream: false,
  }
  return send(BODY)
}

function findBestMatch(options, extractedAnswer) {
  let bestMatch = null
  let highestScore = -1

  options.forEach((option, index) => {
    const score = similarity(option, extractedAnswer)
    if (score > highestScore) {
      highestScore = score
      bestMatch = index
    }
  })

  return bestMatch
}

// Simple similarity function (can be improved)
function similarity(str1, str2) {
  str1 = str1.toLowerCase()
  str2 = str2.toLowerCase()

  // Early exit if strings are identical
  if (str1 === str2) return 1

  const maxLength = Math.max(str1.length, str2.length)
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLength
}

// Levenshtein distance function with memoization
function levenshteinDistance(a, b) {
  // Handle edge cases
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Create a memoization table
  const memo = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(null),
  )

  // Initialize the first row and column of the memoization table
  for (let i = 0; i <= a.length; i++) {
    memo[i][0] = i
  }
  for (let j = 0; j <= b.length; j++) {
    memo[0][j] = j
  }

  // Compute the Levenshtein distance using memoization
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        memo[i][j] = memo[i - 1][j - 1]
      } else {
        memo[i][j] = Math.min(
          memo[i - 1][j] + 1, // Deletion
          memo[i][j - 1] + 1, // Insertion
          memo[i - 1][j - 1] + 1, // Substitution
        )
      }
    }
  }

  return memo[a.length][b.length]
}

async function verifyAnswer(question, answer) {
  const BODY = {
    model: "Meta-Llama-3.1-70B-Instruct",
    messages: [
      {
        role: "system",
        content:
          "You're an AI assistant that helps verify answers. Your response should ALWAYS only be 'yes' or 'no', no other text.",
      },
      {
        role: "user",
        content: `Is this answer correct: ${answer}, for this question: ${question}? Only return 'yes' or 'no'.`,
      },
    ],
    stream: false,
  }

  const verified = await send(BODY)

  if (verified === null) {
    console.log("Failed to verify answer.")
    return false
  }

  console.log("API Response:", verified)

  const noSimilarity = similarity(verified, "no")
  const yesSimilarity = similarity(verified, "yes")

  if (noSimilarity > yesSimilarity) {
    return false
  } else {
    return true
  }
}

async function answerAll() {
  const listItems = document.querySelectorAll('[role="listitem"]')

  for (const listItem of listItems) {
    const questionElement = listItem.querySelector(
      '[role="heading"][aria-level="3"]',
    )
    const question = questionElement
      ? questionElement.textContent.trim()
      : "Unknown Question"

    const options = []
    const radioInputs = []

    const optionElements = listItem.querySelectorAll('span[dir="auto"]')
    optionElements.forEach((optionElement) => {
      const option = optionElement.textContent.trim()
      if (option) {
        options.push(option)
        const radioInput = optionElement
          .closest("label")
          .querySelector('input[type="radio"]')
        radioInputs.push(radioInput)
      }
    })

    let correctAnswerFound = false
    let attempts = 0

    while (attempts < 2 && !correctAnswerFound) {
      const answerText = await getAnswer(question, options)
      const extractedAnswer = await extractAnswer(answerText)
      const bestMatchIndex = findBestMatch(options, extractedAnswer)

      if (bestMatchIndex !== null) {
        const selectedOption = options[bestMatchIndex]
        const isCorrect = await verifyAnswer(question, selectedOption)

        if (isCorrect) {
          radioInputs[bestMatchIndex].click()
          correctAnswerFound = true
        }
      }

      attempts++
    }
  }
}

answerAll();
