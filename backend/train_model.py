# train_model.py
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import pickle
from training_data import training_data

def train_and_save():
    texts = [d[0] for d in training_data]
    categories = [d[1] for d in training_data]
    
    # Category model
    cat_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            stop_words='english'
        )),
        ('clf', LogisticRegression(max_iter=1000))
    ])

    cat_pipeline.fit(texts, categories)
    
    # Create models folder if not exists
    os.makedirs('models', exist_ok=True)
    
    # Save model
    pickle.dump(cat_pipeline, open('models/category_model.pkl', 'wb'))
    print("Success: Category model trained and saved to models/category_model.pkl")

if __name__ == '__main__':
    train_and_save()
