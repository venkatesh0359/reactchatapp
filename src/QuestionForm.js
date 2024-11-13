// src/components/QuestionForm.js
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios';

const QuestionForm = () => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const userId = supabase.auth.user()?.id;

  // Get the API URL from environment variables
  const apiGatewayUrl = process.env.REACT_APP_API_GATEWAY_URL;

  const handleTextQuery = async () => {
    try {
      // Send the question and user_id to the Lambda function via API Gateway
      const res = await axios.post(`${apiGatewayUrl}`, { question, user_id: userId });
      setResponse(res.data.responseText);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h2>Ask a Question</h2>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Type your question here..."
      />
      <button onClick={handleTextQuery}>Ask Question</button>
      <div>
        <h3>Response:</h3>
        <p>{response}</p>
      </div>
    </div>
  );
};

export default QuestionForm;