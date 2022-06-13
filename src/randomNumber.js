let randomNumber = () => {
  let obj = {};
  let randomNumber;
  process.on('message', (parentMsg) => {

    for (let i = 0; i < parentMsg; i++) {
      randomNumber = Math.floor(Math.random() * 1000)
      if (obj[randomNumber]) {
        obj[randomNumber]++

      } else {
        obj[randomNumber] = 1

      }
    }

    process.send(obj)
  })
}

randomNumber()