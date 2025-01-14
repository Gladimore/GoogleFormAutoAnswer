const BASE_URL = "https://llm-2-0.vercel.app/api/chat"
const PASSWORD = "" // enter password here

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
  const prompt = `Question: ${question}\nOptions:\n${options.map((opt, index) => `${index + 1}. ${opt}`).join("\n")}\nProvide the correct answer with detailed explanation.`
  
  const BODY = {
    model: "Meta-Llama-3.1-70B-Instruct",
    messages: [
      {
        role: "system",
        content: "You are a precise answer validator. First state the correct answer, then explain your reasoning."
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: false,
    max_tokens: 1024
  }
  return send(BODY)
}

async function validateAnswer(question, answer, options) {
  const BODY = {
    model: "Meta-Llama-3.1-70B-Instruct", 
    messages: [
      {
        role: "system",
        content: "You are a strict answer validator. Respond with CORRECT or INCORRECT followed by brief explanation."
      },
      {
        role: "user",
        content: `Question: ${question}\nProposed answer: ${answer}\nAvailable options: ${options.join(", ")}\nIs this answer correct?`
      }
    ],
    stream: false,
    max_tokens: 256
  }
  
  const response = await send(BODY)
  return response.toLowerCase().includes("correct")
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

function similarity(str1, str2) {
  str1 = str1.toLowerCase()
  str2 = str2.toLowerCase()
  
  if (str1 === str2) return 1
  
  const maxLength = Math.max(str1.length, str2.length)
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLength
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const memo = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(null)
  )

  for (let i = 0; i <= a.length; i++) {
    memo[i][0] = i
  }
  for (let j = 0; j <= b.length; j++) {
    memo[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        memo[i][j] = memo[i - 1][j - 1]
      } else {
        memo[i][j] = Math.min(
          memo[i - 1][j] + 1,
          memo[i][j - 1] + 1,
          memo[i - 1][j - 1] + 1
        )
      }
    }
  }

  return memo[a.length][b.length]
}

async function answerAll() {
  const listItems = document.querySelectorAll('[role="listitem"]')
  
  for (const listItem of listItems) {
    const questionElement = listItem.querySelector('[role="heading"][aria-level="3"]')
    const question = questionElement ? questionElement.textContent.trim() : "Unknown Question"
    
    const options = []
    const radioInputs = []
    const optionElements = listItem.querySelectorAll('span[dir="auto"]')
    
    optionElements.forEach((optionElement) => {
      const option = optionElement.textContent.trim()
      if (option) {
        options.push(option)
        const radioInput = optionElement.closest("label").querySelector('input[type="radio"]')
        radioInputs.push(radioInput)
      }
    })

    const answerText = await getAnswer(question, options)
    const isValid = await validateAnswer(question, answerText, options)
    
    if (isValid) {
      const bestMatchIndex = findBestMatch(options, answerText)
      if (bestMatchIndex !== null) {
        radioInputs[bestMatchIndex].click()
      }
    }
  }
}

// Execute the answer system
answerAll()
