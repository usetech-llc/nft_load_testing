#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod loadtester {
    use ink_storage::collections::Vec as InkVec;
    use ink_prelude::vec::Vec;

    #[ink(storage)]
    pub struct LoadTester {
        vector: InkVec<u64>,
    }

    impl LoadTester {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                vector: InkVec::new(),
            }
        }

        #[ink(message)]
        pub fn bloat(&mut self, count: u64){
            for i in 1..count+1 {
                self.vector.push(i);
            }
        }

        #[ink(message)]
        pub fn get(&self) -> Vec<u64> {
            let mut data: Vec<u64> = Vec::new();
            for num in self.vector.iter() {
                data.push(*num);
            }
            data
        }
    }

    #[cfg(test)]
    mod tests {
       
        use super::*;

        #[test]
        fn it_works() {
            let mut lt = LoadTester::new();
            lt.bloat(4);
            assert_eq!(lt.get(), [1,2,3,4]);
            lt.bloat(3);
            assert_eq!(lt.get(), [1,2,3,4,1,2,3]);
        }
    }
}
