const { diff } = require('deep-diff');
const _ = require('lodash');
/*

const model = new Entity('User')
model.ttl() // enable ttl for this entity
model.cascade('comments', 'delete')
model.uniqueIndex('name');
model.index('name');
model.compoundIndex('long', 'lat');
model.hasOne('address', 'Address');
model.uniqueIndex('address');
model.hasMany('friends', 'Friend'); // what if entity has 1000 friends? are the pointers all stored in document??
                                    // there must be and add/remove function on this level
model.invertedIndex('bio');
*/
/*
const repository = new Repository()
repository.declare(User);
repository.declare(Post);
repository.declare(Comment);

repository.search('Post', post => {
  post.comments().search('where contains i am', comment => {
    console.log(comment.getText());
    comment.getAuthor(author =>
      console.log(author.getName()));
  })
});
*/

function extendSchema(c, schema) {
  return c ? extendSchema(
    Object.getPrototypeOf(c), 
    _.merge({}, c.schema, schema)
  ) : schema;
}

function diffSchema(previous, current) {
  return diff(previous, current).map(d => {
    switch (d.kind) {
      case 'N':
        console.log(d.rhs);
        break;
      case 'D':
        console.log(d.rhs);
        break;
      case 'E':
        console.log(d.rhs);
        break;
      case 'A':
        console.log(d.rhs);
        break;
    }
  });
}

class Entity {
  static getSchema() {
    return extendSchema(this, {});
  }
}
Entity.schema = {
  fields: {}
};

class User extends Entity {}
User.schema = {
  fields: {
    user: { $index: true }
  }
};

class SuperUser extends User {}
SuperUser.schema = {
  fields: {
    superUser: { $index: true }
  }
};

SuperUser.map = class {
  static allWithAUser(k, v, emit) {
    emit(k, v);
  }
  static allWithAName(k, v, emit) {
    emit(k, v);
  }
}

SuperUser.reduce = class {
  static allWithAUser(k, v, emit) {
    emit(k, v);
  }
  static allWithAName(k, v, emit) {
    emit(k, v);
  }
}

console.log(SuperUser.getSchema());
console.log(diffSchema( 
  { fields: { a: { unique: true }, b: 1 } },
  { fields: { a: { unique: false }, c: 3 } }));
