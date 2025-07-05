from flask import Flask, request, jsonify
from transformers import T5ForConditionalGeneration, T5Tokenizer
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 

model_path = "ArtemKalchenko/t5-small_for_sql_generation"
model = T5ForConditionalGeneration.from_pretrained(model_path)
tokenizer = T5Tokenizer.from_pretrained(model_path)

@app.route('/generate_sql', methods=['POST'])
def generate_sql():
    data = request.json
    prompt = data.get('prompt', '')
    encoded = tokenizer(
        prompt,
        padding=True,
        truncation=True,
        max_length=256,
        return_tensors="pt"
    )
    outputs = model.generate(
        **encoded,
        max_length=256,
        num_beams = 1
    )
    sql = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return jsonify({'server_response': sql})

if __name__ == '__main__':
    app.run(host = "0.0.0.0", port=5000)
