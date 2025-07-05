# SQL Query Generator UI

This project is a web-based interface built with **Next.js** for interacting with a custom fine-tuned language model that translates natural language questions in English into SQL queries. 
The model, [`ArtemKalchenko/t5-small_for_sql_generation`](https://huggingface.co/ArtemKalchenko/t5-small_for_sql_generation), is a version of **T5-small** that was fine-tuned by the author specifically for the task of SQL generation.

## Features

- Input English-language database questions
- Generate SQL queries using a T5-based model
- Edit and execute the generated SQL on user-provided data
- Create and modify database schema interactively

## Backend

The backend server is implemented using **Flask**. It loads the `t5-small` model and handles requests from the frontend to perform natural language to SQL translation.

## Example of schema-editor page:
![image](https://github.com/user-attachments/assets/82f331ca-d21a-4906-bf89-7b06716d9f62)

## Example of main page
![image](https://github.com/user-attachments/assets/099734a3-3f2e-4ab2-b180-c2cc907eae18)

